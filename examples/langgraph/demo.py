"""
Demo script showing LangGraph Weather Agent with x402 integration.
This script demonstrates the complete workflow without requiring external dependencies.
"""

import asyncio
import json
from typing import Dict, Any


class MockX402Client:
    """Mock x402 client for demonstration purposes"""
    
    async def connect(self):
        print("🔌 Connected to LLM Wallet MCP server")
        return True
    
    async def disconnect(self):
        print("🔌 Disconnected from MCP server")
    
    async def check_wallet_balance(self, network: str = "polygon-amoy") -> Dict[str, Any]:
        return {
            "usdc_balance": "1.234",
            "native_balance": "0.056",
            "network": network
        }
    
    async def get_payment_history(self, limit: int = 10) -> list:
        return [
            {
                "timestamp": "2024-01-15T10:30:00Z",
                "amount": "0.001",
                "recipient": "weather-api",
                "status": "completed",
                "tx_hash": "0x1234...5678"
            },
            {
                "timestamp": "2024-01-15T09:15:00Z", 
                "amount": "0.002",
                "recipient": "news-api",
                "status": "completed",
                "tx_hash": "0xabcd...efgh"
            }
        ]
    
    async def call_x402_api(
        self, 
        url: str, 
        method: str = "GET", 
        params: Dict[str, Any] = None,
        max_amount: str = "0.001"
    ) -> Dict[str, Any]:
        """Mock x402 API call"""
        location = params.get("city", "Unknown") if params else "Unknown"
        
        # Simulate API response
        weather_data = {
            "location": location,
            "temperature": "22°C",
            "condition": "Partly Cloudy",
            "humidity": "65%",
            "wind": "10 km/h",
            "timestamp": "2024-01-15T12:00:00Z"
        }
        
        # Simulate payment
        payment_info = {
            "payment_amount": "0.001",
            "transaction_hash": "0x9876...5432",
            "status": "completed"
        }
        
        print(f"💳 Payment: {payment_info['payment_amount']} USDC")
        print(f"🔗 Transaction: {payment_info['transaction_hash']}")
        
        return {
            "success": True,
            "data": weather_data,
            "payment_amount": payment_info["payment_amount"],
            "transaction_hash": payment_info["transaction_hash"]
        }


class MockLLM:
    """Mock LLM for demonstration purposes"""
    
    async def ainvoke(self, prompt: str) -> Any:
        """Mock LLM response"""
        if "extract" in prompt.lower():
            # Location extraction
            if "london" in prompt.lower():
                return type('Response', (), {'content': 'London'})()
            elif "tokyo" in prompt.lower():
                return type('Response', (), {'content': 'Tokyo'})()
            elif "new york" in prompt.lower():
                return type('Response', (), {'content': 'New York'})()
            else:
                return type('Response', (), {'content': 'Unknown'})()
        
        elif "weather" in prompt.lower():
            # Weather processing
            return type('Response', (), {
                'content': 'The weather is pleasant with partly cloudy skies. Temperature is comfortable at 22°C with moderate humidity at 65%. Light winds at 10 km/h make for a nice day.'
            })()
        
        return type('Response', (), {'content': 'Mock response'})()


class DemoWeatherAgent:
    """Demo version of the LangGraph Weather Agent"""
    
    def __init__(self):
        self.x402_client = MockX402Client()
        self.llm = MockLLM()
    
    async def extract_location(self, query: str) -> str:
        """Extract location from query"""
        print(f"🧠 Extracting location from: '{query}'")
        
        prompt = f"Extract location from: {query}"
        response = await self.llm.ainvoke(prompt)
        location = response.content.strip()
        
        print(f"📍 Extracted location: {location}")
        return location
    
    async def get_weather(self, location: str) -> Dict[str, Any]:
        """Get weather data via x402 API"""
        if location == "Unknown":
            return {"error": "No location found"}
        
        print(f"🌤️ Getting weather for {location}...")
        
        await self.x402_client.connect()
        try:
            result = await self.x402_client.call_x402_api(
                url="http://localhost:4021/weather",
                method="GET",
                params={"city": location},
                max_amount="0.001"
            )
            return result
        finally:
            await self.x402_client.disconnect()
    
    async def process_weather(self, weather_data: Dict[str, Any], location: str) -> str:
        """Process weather data with LLM"""
        print("🧠 Processing weather data...")
        
        prompt = f"Create a weather summary for {location}: {json.dumps(weather_data, indent=2)}"
        response = await self.llm.ainvoke(prompt)
        
        return response.content.strip()
    
    async def ask(self, question: str) -> str:
        """Main agent workflow"""
        print(f"\n❓ Query: {question}")
        print("=" * 50)
        
        # Step 1: Extract location
        location = await self.extract_location(question)
        
        if location == "Unknown":
            return "❌ No location found in your query. Please specify a city."
        
        # Step 2: Get weather data
        weather_result = await self.get_weather(location)
        
        if weather_result.get("error"):
            return f"❌ Error: {weather_result['error']}"
        
        if not weather_result.get("success"):
            return f"❌ Failed to get weather data"
        
        # Step 3: Process weather data
        weather_summary = await self.process_weather(weather_result["data"], location)
        
        # Step 4: Format response
        payment_info = weather_result.get("payment_amount", "Unknown")
        tx_hash = weather_result.get("transaction_hash", "Unknown")
        
        response = f"""🌤️ Weather for {location}:

{weather_summary}

💳 Payment: {payment_info} USDC
🔗 Transaction: {tx_hash[:10]}..."""
        
        return response
    
    async def get_wallet_info(self) -> Dict[str, Any]:
        """Get wallet information"""
        await self.x402_client.connect()
        try:
            balance = await self.x402_client.check_wallet_balance()
            history = await self.x402_client.get_payment_history()
            return {"balance": balance, "recent_payments": history}
        finally:
            await self.x402_client.disconnect()


async def demo():
    """Run the demo"""
    print("🤖 LangGraph Weather Agent with x402 Integration - DEMO")
    print("=" * 60)
    
    agent = DemoWeatherAgent()
    
    # Show wallet info
    print("\n💰 Wallet Information:")
    wallet_info = await agent.get_wallet_info()
    balance = wallet_info["balance"]
    print(f"   USDC Balance: {balance['usdc_balance']}")
    print(f"   Native Balance: {balance['native_balance']}")
    print(f"   Network: {balance['network']}")
    print(f"   Recent Payments: {len(wallet_info['recent_payments'])}")
    
    # Test queries
    test_queries = [
        "What's the weather like in London?",
        "How's the weather in Tokyo?", 
        "Tell me about New York weather",
        "What's the temperature?"  # No location
    ]
    
    for query in test_queries:
        response = await agent.ask(query)
        print(f"\n🤖 Response:\n{response}")
        print("-" * 40)
    
    print("\n🎉 Demo completed!")
    print("\n📝 To use with real LangGraph:")
    print("   1. Install: pip install -r requirements.txt")
    print("   2. Set OPENAI_API_KEY environment variable")
    print("   3. Run: python weather_agent_x402.py")


if __name__ == "__main__":
    asyncio.run(demo())
