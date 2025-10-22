"""
Test script to verify the weather agent structure without running it
"""

def test_agent_structure():
    """Test that the agent structure is correct"""
    
    # Read the weather agent file
    with open('weather_agent.py', 'r') as f:
        content = f.read()
    
    # Check that key components are present
    checks = [
        ("WeatherAgent class", "class WeatherAgent:" in content),
        ("LangChain imports", "from langchain.tools import StructuredTool" in content),
        ("Weather tool", "def get_weather" in content),
        ("Agent creation", "create_react_agent" in content),
        ("Ask method", "async def ask" in content),
        ("Main function", "def main():" in content)
    ]
    
    print("🧪 Testing Weather Agent Structure")
    print("=" * 40)
    
    all_passed = True
    for check_name, passed in checks:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {check_name}")
        if not passed:
            all_passed = False
    
    print("=" * 40)
    if all_passed:
        print("🎉 All structure tests passed!")
        print("The agent is ready for x402 integration.")
    else:
        print("❌ Some tests failed. Please check the agent structure.")
    
    return all_passed

if __name__ == "__main__":
    test_agent_structure()
