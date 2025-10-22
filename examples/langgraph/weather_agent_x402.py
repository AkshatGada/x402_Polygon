"""
LangGraph Weather Agent with x402 Integration
This agent uses LangGraph to create a stateful workflow for weather queries with x402 payments.
"""

import asyncio
import json
from typing import TypedDict, Dict, Any, List
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from x402_mcp_client import X402MCPClient, X402PaymentResult


class WeatherGraphState(TypedDict):
    """State for the weather agent graph"""
    # Input
    user_query: str
    extracted_location: str
    
    # Processing
    weather_data: Dict[str, Any]
    weather_summary: str
    
    # Output
    final_response: str
    error_message: str
    payment_info: Dict[str, Any]


class WeatherAgentX402:
    """
    LangGraph-based weather agent with x402 payment integration.
    
    This agent:
    1. Extracts location from user query
    2. Calls x402-protected weather API
    3. Processes weather data with LLM
    4. Returns formatted response
    """
    
    def __init__(self, openai_api_key: str = None):
        """
        Initialize the weather agent.
        
        Args:
            openai_api_key: OpenAI API key (or set OPENAI_API_KEY env var)
        """
        self.llm = ChatOpenAI(
            model="gpt-3.5-turbo",
            temperature=0.1,
            api_key=openai_api_key
        )
        self.x402_client = X402MCPClient()
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow"""
        
        # Create the state graph
        graph = StateGraph(WeatherGraphState)
        
        # Add nodes
        graph.add_node("extract_location", self._extract_location_node)
        graph.add_node("get_weather", self._get_weather_node)
        graph.add_node("process_weather", self._process_weather_node)
        graph.add_node("format_response", self._format_response_node)
        graph.add_node("handle_error", self._handle_error_node)
        
        # Add edges
        graph.add_edge("extract_location", "get_weather")
        graph.add_edge("get_weather", "process_weather")
        graph.add_edge("process_weather", "format_response")
        graph.add_edge("format_response", END)
        
        # Add conditional edge for error handling
        graph.add_conditional_edges(
            "get_weather",
            self._should_handle_error,
            {
                "error": "handle_error",
                "continue": "process_weather"
            }
        )
        
        # Set entry point
        graph.set_entry_point("extract_location")
        
        return graph.compile()
    
    async def _extract_location_node(self, state: WeatherGraphState) -> WeatherGraphState:
        """Extract location from user query using LLM"""
        try:
            prompt = f"""
            Extract the location/city from this user query: "{state['user_query']}"
            
            Return only the city name, nothing else.
            If no location is mentioned, return "Unknown".
            
            Examples:
            - "What's the weather in London?" -> "London"
            - "How's the weather in New York City?" -> "New York City"
            - "Weather for Paris please" -> "Paris"
            - "What's the temperature?" -> "Unknown"
            """
            
            response = await self.llm.ainvoke(prompt)
            location = response.content.strip().replace('"', '').replace("'", "")
            
            return {
                **state,
                "extracted_location": location
            }
            
        except Exception as e:
            return {
                **state,
                "extracted_location": "Unknown",
                "error_message": f"Failed to extract location: {str(e)}"
            }
    
    async def _get_weather_node(self, state: WeatherGraphState) -> WeatherGraphState:
        """Call x402-protected weather API"""
        try:
            location = state.get("extracted_location", "Unknown")
            
            if location == "Unknown":
                return {
                    **state,
                    "error_message": "No location found in your query. Please specify a city."
                }
            
            # Connect to x402 client
            await self.x402_client.connect()
            
            try:
                # Make x402 payment for weather API
                result = await self.x402_client.call_x402_api(
                    url="http://localhost:4021/weather",
                    method="GET",
                    params={"city": location},
                    max_amount="0.001"  # Max 0.001 USDC
                )
                
                if result.success:
                    weather_data = result.data
                    payment_info = {
                        "payment_amount": result.payment_amount,
                        "transaction_hash": result.transaction_hash,
                        "success": True
                    }
                    
                    return {
                        **state,
                        "weather_data": weather_data,
                        "payment_info": payment_info
                    }
                else:
                    return {
                        **state,
                        "error_message": f"Failed to get weather data: {result.error}"
                    }
                    
            finally:
                await self.x402_client.disconnect()
                
        except Exception as e:
            return {
                **state,
                "error_message": f"Error calling weather API: {str(e)}"
            }
    
    async def _process_weather_node(self, state: WeatherGraphState) -> WeatherGraphState:
        """Process weather data with LLM to create a summary"""
        try:
            weather_data = state.get("weather_data", {})
            location = state.get("extracted_location", "Unknown")
            
            # Create a summary of the weather data
            prompt = f"""
            Based on this weather data for {location}, create a friendly, informative weather summary:
            
            Weather Data: {json.dumps(weather_data, indent=2)}
            
            Please provide:
            1. Current conditions
            2. Temperature
            3. Any notable weather features
            4. A brief, conversational summary
            
            Keep it concise but informative.
            """
            
            response = await self.llm.ainvoke(prompt)
            weather_summary = response.content.strip()
            
            return {
                **state,
                "weather_summary": weather_summary
            }
            
        except Exception as e:
            return {
                **state,
                "error_message": f"Failed to process weather data: {str(e)}"
            }
    
    async def _format_response_node(self, state: WeatherGraphState) -> WeatherGraphState:
        """Format the final response"""
        try:
            weather_summary = state.get("weather_summary", "")
            payment_info = state.get("payment_info", {})
            location = state.get("extracted_location", "")
            
            # Add payment info to response
            if payment_info.get("success"):
                payment_text = f"\n\n💳 Payment: {payment_info.get('payment_amount', 'Unknown')} USDC"
                if payment_info.get("transaction_hash"):
                    payment_text += f"\n🔗 Transaction: {payment_info['transaction_hash'][:10]}..."
            else:
                payment_text = "\n\n💳 Payment: Failed"
            
            final_response = f"🌤️ Weather for {location}:\n\n{weather_summary}{payment_text}"
            
            return {
                **state,
                "final_response": final_response
            }
            
        except Exception as e:
            return {
                **state,
                "final_response": f"Error formatting response: {str(e)}"
            }
    
    async def _handle_error_node(self, state: WeatherGraphState) -> WeatherGraphState:
        """Handle errors in the workflow"""
        error_message = state.get("error_message", "An unknown error occurred")
        
        return {
            **state,
            "final_response": f"❌ Error: {error_message}"
        }
    
    def _should_handle_error(self, state: WeatherGraphState) -> str:
        """Determine if we should handle an error"""
        if state.get("error_message"):
            return "error"
        return "continue"
    
    async def ask(self, question: str) -> str:
        """
        Ask the weather agent a question.
        
        Args:
            question: User's weather-related question
            
        Returns:
            Weather information with payment details
        """
        try:
            # Initialize state
            initial_state = WeatherGraphState(
                user_query=question,
                extracted_location="",
                weather_data={},
                weather_summary="",
                final_response="",
                error_message="",
                payment_info={}
            )
            
            # Run the graph
            result = await self.graph.ainvoke(initial_state)
            
            return result.get("final_response", "No response generated")
            
        except Exception as e:
            return f"❌ Agent error: {str(e)}"
    
    async def get_wallet_info(self) -> Dict[str, Any]:
        """Get wallet balance and payment history"""
        try:
            await self.x402_client.connect()
            
            balance = await self.x402_client.check_wallet_balance()
            history = await self.x402_client.get_payment_history(limit=5)
            
            return {
                "balance": balance,
                "recent_payments": history
            }
            
        except Exception as e:
            return {"error": str(e)}
        finally:
            await self.x402_client.disconnect()


# Example usage and testing
async def main():
    """Test the weather agent"""
    
    # Initialize agent
    agent = WeatherAgentX402()
    
    print("🤖 LangGraph Weather Agent with x402 Integration")
    print("=" * 50)
    
    # Check wallet info
    print("\n💰 Checking wallet information...")
    wallet_info = await agent.get_wallet_info()
    if "error" not in wallet_info:
        print(f"Balance: {wallet_info['balance']}")
        print(f"Recent payments: {len(wallet_info['recent_payments'])}")
    else:
        print(f"❌ Wallet error: {wallet_info['error']}")
    
    # Test weather queries
    test_queries = [
        "What's the weather like in London?",
        "How's the weather in Tokyo?",
        "Tell me about the weather in New York",
        "What's the temperature in Paris?"
    ]
    
    for query in test_queries:
        print(f"\n❓ Query: {query}")
        response = await agent.ask(query)
        print(f"🤖 Response: {response}")
        print("-" * 30)


if __name__ == "__main__":
    # Run the test
    asyncio.run(main())
