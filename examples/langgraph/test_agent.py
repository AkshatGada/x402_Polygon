"""
Test script for the LangGraph Weather Agent with x402 integration.
"""

import asyncio
import os
from weather_agent_x402 import WeatherAgentX402


async def test_basic_functionality():
    """Test basic agent functionality"""
    print("🧪 Testing LangGraph Weather Agent with x402")
    print("=" * 50)
    
    # Check if OpenAI API key is set
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Please set OPENAI_API_KEY environment variable")
        return
    
    # Initialize agent
    agent = WeatherAgentX402()
    
    # Test 1: Check wallet info
    print("\n1️⃣ Testing wallet information...")
    wallet_info = await agent.get_wallet_info()
    if "error" not in wallet_info:
        print("✅ Wallet connection successful")
        print(f"   Balance: {wallet_info.get('balance', 'Unknown')}")
        print(f"   Recent payments: {len(wallet_info.get('recent_payments', []))}")
    else:
        print(f"❌ Wallet error: {wallet_info['error']}")
        return
    
    # Test 2: Simple weather query
    print("\n2️⃣ Testing weather query...")
    response = await agent.ask("What's the weather in London?")
    print(f"✅ Response: {response[:100]}...")
    
    # Test 3: Multiple queries
    print("\n3️⃣ Testing multiple queries...")
    queries = [
        "Weather in Tokyo",
        "How's New York weather?",
        "Temperature in Paris"
    ]
    
    for i, query in enumerate(queries, 1):
        print(f"   Query {i}: {query}")
        response = await agent.ask(query)
        if "❌" not in response:
            print(f"   ✅ Success: {response[:50]}...")
        else:
            print(f"   ❌ Error: {response}")
    
    print("\n🎉 Testing completed!")


async def test_error_handling():
    """Test error handling scenarios"""
    print("\n🔍 Testing error handling...")
    
    agent = WeatherAgentX402()
    
    # Test 1: No location specified
    response = await agent.ask("What's the weather?")
    print(f"   No location: {response}")
    
    # Test 2: Invalid query
    response = await agent.ask("Hello there!")
    print(f"   Invalid query: {response}")


async def interactive_mode():
    """Interactive mode for testing"""
    print("\n💬 Interactive Mode")
    print("Type 'quit' to exit")
    print("=" * 30)
    
    agent = WeatherAgentX402()
    
    while True:
        try:
            query = input("\n❓ Ask about weather: ").strip()
            if query.lower() in ['quit', 'exit', 'q']:
                break
            
            if not query:
                continue
            
            print("🤔 Thinking...")
            response = await agent.ask(query)
            print(f"🤖 {response}")
            
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"❌ Error: {e}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "interactive":
        asyncio.run(interactive_mode())
    else:
        # Run basic tests
        asyncio.run(test_basic_functionality())
        asyncio.run(test_error_handling())
        
        # Ask if user wants interactive mode
        try:
            choice = input("\n💬 Would you like to try interactive mode? (y/n): ").strip().lower()
            if choice in ['y', 'yes']:
                asyncio.run(interactive_mode())
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
