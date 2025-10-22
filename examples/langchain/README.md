# Weather Agent - LangChain Example

This example shows how to create a normal LangChain agent that provides weather information.

## What This Agent Does

The weather agent:
- Takes user questions about weather
- Uses a LangChain tool to get weather data
- Provides natural language responses about weather conditions

## Current Implementation

This is a **normal agent without x402 support** - it uses a mock weather API that returns static data.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set your OpenAI API key:**
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   ```

3. **Run the agent:**
   ```bash
   python weather_agent.py
   ```

## Example Usage

```python
from weather_agent import WeatherAgent

agent = WeatherAgent()

# Ask questions about weather
response = await agent.ask("What's the weather like in New York?")
print(response)  # "Weather in New York: Sunny, 72°F, Light winds"
```

## Next Step: Add x402 Support

This agent currently uses a mock weather API. To integrate with real x402-protected APIs:

1. Start the LLM Wallet MCP server
2. Use the `generate_agent_client` tool in Cursor:
   ```bash
   @LLM Wallet generate_agent_client(framework='langchain', language='python', apiEndpoint='http://localhost:4021/weather')
   ```
3. Replace the mock weather tool with the generated x402 client

## Testing the Integration

After adding x402 support, the agent will be able to:
- Call real x402-protected weather APIs
- Automatically handle payments
- Get actual weather data instead of mock responses

## File Structure

```
examples/langchain/
├── weather_agent.py      # Main agent implementation
├── requirements.txt      # Python dependencies
└── README.md            # This file
```
