# LangGraph Weather Agent with x402 Integration

This example demonstrates how to integrate LangGraph with x402 payments using the LLM Wallet MCP server. The agent creates a stateful workflow for weather queries that automatically handles payments for premium weather data.

## 🌟 Features

- **Stateful Workflow**: Uses LangGraph to create a multi-step weather query process
- **x402 Payments**: Automatically pays for weather API calls using x402 protocol
- **LLM Integration**: Uses OpenAI GPT to extract locations and format responses
- **Error Handling**: Comprehensive error handling and recovery
- **Wallet Management**: Check balances and payment history
- **Real-time Payments**: Live payment processing with transaction tracking

## 🏗️ Architecture

```
User Query → Location Extraction → x402 API Call → Data Processing → Formatted Response
     ↓              ↓                    ↓              ↓              ↓
  LangGraph    OpenAI GPT        LLM Wallet MCP    OpenAI GPT    Final Output
```

## 📋 Prerequisites

1. **LLM Wallet MCP Server**: Must be running and accessible
2. **OpenAI API Key**: For location extraction and response formatting
3. **Weather API**: x402-protected weather service (e.g., `http://localhost:4021/weather`)
4. **Funded Wallet**: Wallet with USDC balance for payments

## 🚀 Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Environment Variables

```bash
export OPENAI_API_KEY="your-openai-api-key"
```

### 3. Ensure LLM Wallet MCP is Running

The agent expects the LLM Wallet MCP server to be running at:
```
/Users/agada/x402_polygon/llm-wallet/dist/index.js
```

### 4. Start Weather API Server

Make sure your x402-protected weather API is running at `http://localhost:4021/weather`

## 🧪 Testing

### Basic Test

```bash
python test_agent.py
```

### Interactive Mode

```bash
python test_agent.py interactive
```

### Manual Testing

```python
import asyncio
from weather_agent_x402 import WeatherAgentX402

async def test():
    agent = WeatherAgentX402()
    
    # Check wallet info
    wallet_info = await agent.get_wallet_info()
    print(f"Wallet: {wallet_info}")
    
    # Ask weather question
    response = await agent.ask("What's the weather in London?")
    print(f"Response: {response}")

asyncio.run(test())
```

## 🔧 Usage

### Basic Usage

```python
from weather_agent_x402 import WeatherAgentX402
import asyncio

async def main():
    # Initialize agent
    agent = WeatherAgentX402()
    
    # Ask weather questions
    response = await agent.ask("What's the weather in Tokyo?")
    print(response)
    
    # Check wallet status
    wallet_info = await agent.get_wallet_info()
    print(f"Balance: {wallet_info['balance']}")

# Run
asyncio.run(main())
```

### Advanced Usage

```python
# Custom configuration
agent = WeatherAgentX402(openai_api_key="your-key")

# Multiple queries
queries = [
    "Weather in London",
    "How's New York weather?",
    "Temperature in Paris"
]

for query in queries:
    response = await agent.ask(query)
    print(f"Query: {query}")
    print(f"Response: {response}\n")
```

## 📊 Workflow Steps

1. **Location Extraction**: LLM extracts city/location from user query
2. **x402 API Call**: Agent pays for and calls weather API
3. **Data Processing**: LLM processes raw weather data
4. **Response Formatting**: Creates user-friendly weather summary
5. **Payment Info**: Includes payment details in response

## 💰 Payment Flow

1. **Balance Check**: Verifies wallet has sufficient funds
2. **Payment Creation**: Creates x402 payment for API call
3. **Transaction**: Processes payment on Polygon Amoy
4. **API Access**: Receives weather data after successful payment
5. **Receipt**: Returns payment amount and transaction hash

## 🛠️ Customization

### Custom Weather API

```python
# Modify the API endpoint in weather_agent_x402.py
result = await self.x402_client.call_x402_api(
    url="https://your-weather-api.com/current",  # Your API
    method="GET",
    params={"location": location},
    max_amount="0.01"  # Adjust payment amount
)
```

### Custom LLM Model

```python
# In WeatherAgentX402.__init__()
self.llm = ChatOpenAI(
    model="gpt-4",  # Use GPT-4
    temperature=0.1,
    api_key=openai_api_key
)
```

### Custom Payment Limits

```python
# Adjust maximum payment amount
result = await self.x402_client.call_x402_api(
    url="http://localhost:4021/weather",
    method="GET",
    params={"city": location},
    max_amount="0.05"  # Higher limit
)
```

## 🔍 Troubleshooting

### Common Issues

1. **MCP Connection Failed**
   - Ensure LLM Wallet MCP server is running
   - Check the server path in `x402_mcp_client.py`

2. **OpenAI API Error**
   - Verify `OPENAI_API_KEY` is set correctly
   - Check API key permissions and billing

3. **Payment Failed**
   - Ensure wallet has sufficient USDC balance
   - Check network connectivity to Polygon Amoy

4. **Weather API Error**
   - Verify weather API server is running
   - Check API endpoint URL and parameters

### Debug Mode

```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Run with verbose output
agent = WeatherAgentX402()
response = await agent.ask("Weather in London")
```

## 📁 File Structure

```
examples/langgraph/
├── x402_mcp_client.py      # x402 MCP client
├── weather_agent_x402.py   # Main LangGraph agent
├── test_agent.py           # Test script
├── requirements.txt        # Dependencies
└── README.md              # This file
```

## 🚀 Next Steps

1. **Add More APIs**: Integrate additional x402-protected services
2. **Multi-Agent**: Create multiple specialized agents
3. **Caching**: Add response caching to reduce API calls
4. **Analytics**: Track payment patterns and usage
5. **UI**: Build a web interface for the agent

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add your improvements
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
