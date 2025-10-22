"""
Weather Agent - LangChain Example
This is how an AI developer would normally create a weather agent without x402 support.
"""

import os
import asyncio
from typing import Dict, Any
from langchain.tools import StructuredTool
from langchain.agents import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

class WeatherAgent:
    """A simple weather agent that calls weather APIs"""
    
    def __init__(self):
        self.llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)
        self.tools = []
        self._setup_tools()
        self.agent = create_react_agent(self.llm, self.tools)
    
    def _setup_tools(self):
        """Setup the weather tool"""
        
        def get_weather(location: str) -> str:
            """
            Get weather data for a location.
            
            Args:
                location: The city or location to get weather for
                
            Returns:
                Weather information as a string
            """
            try:
                # Simulate API call to weather service
                # In a real implementation, this would call a weather API
                return f"Weather in {location}: Sunny, 72°F, Light winds"
            except Exception as e:
                return f"Error getting weather for {location}: {str(e)}"
        
        # Create the tool
        weather_tool = StructuredTool.from_function(
            name="get_weather",
            func=get_weather,
            description="Get current weather data for any location"
        )
        
        self.tools.append(weather_tool)
    
    async def ask(self, question: str) -> str:
        """
        Ask the agent a question about weather
        
        Args:
            question: The user's question
            
        Returns:
            The agent's response
        """
        try:
            result = await self.agent.ainvoke({"input": question})
            return result["output"]
        except Exception as e:
            return f"Error processing question: {str(e)}"
    
    def run_interactive(self):
        """Run the agent in interactive mode"""
        print("🌤️  Weather Agent")
        print("Ask me about the weather! Type 'quit' to exit.")
        print("-" * 50)
        
        while True:
            try:
                question = input("\n👤 You: ").strip()
                if question.lower() in ['quit', 'exit', 'bye']:
                    print("👋 Goodbye!")
                    break
                
                if not question:
                    continue
                
                print("🤖 Agent: ", end="", flush=True)
                response = asyncio.run(self.ask(question))
                print(response)
                
            except KeyboardInterrupt:
                print("\n👋 Goodbye!")
                break
            except Exception as e:
                print(f"❌ Error: {e}")

def main():
    """Main function to run the weather agent"""
    print("Creating Weather Agent...")
    agent = WeatherAgent()
    
    # Test the agent with a few questions
    print("\n🧪 Testing the agent:")
    print("-" * 30)
    
    test_questions = [
        "What's the weather like in New York?",
        "Tell me about the weather in London",
        "How's the weather in Tokyo?"
    ]
    
    for question in test_questions:
        print(f"\n👤 Question: {question}")
        response = asyncio.run(agent.ask(question))
        print(f"🤖 Response: {response}")
    
    print("\n" + "="*50)
    print("🎯 Agent created successfully!")
    print("This agent currently uses a mock weather API.")
    print("Next step: Use the MCP tool to add x402 payment support!")
    print("="*50)
    
    # Optionally run in interactive mode
    run_interactive = input("\nWould you like to run in interactive mode? (y/n): ").lower().strip()
    if run_interactive == 'y':
        agent.run_interactive()

if __name__ == "__main__":
    main()
