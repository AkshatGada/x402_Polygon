"""
x402 MCP Client for LangGraph Integration
This client handles x402 payments via the LLM Wallet MCP server.
"""

import json
import asyncio
import subprocess
from typing import Dict, Any, Optional, List
from dataclasses import dataclass


@dataclass
class X402PaymentResult:
    """Result from an x402 API call"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    payment_amount: Optional[str] = None
    transaction_hash: Optional[str] = None


class X402MCPClient:
    """
    Client for making x402-protected API calls via LLM Wallet MCP server.
    g limits
    2. Make x402 payments for API calls
    This client communicates with the LLM Wallet MCP server to:
    1. Check wallet balance and spendin
    3. Handle payment verification and settlement
    """
    
    def __init__(self, mcp_server_path: str = "/Users/agada/x402_polygon/llm-wallet/dist/index.js"):
        """
        Initialize the x402 MCP client.
        
        Args:
            mcp_server_path: Path to the LLM Wallet MCP server executable
        """
        self.mcp_server_path = mcp_server_path
        self.process = None
        self.request_id = 0
    
    async def connect(self):
        """Connect to the MCP server"""
        try:
            # Start the MCP server process
            self.process = await asyncio.create_subprocess_exec(
                "node", self.mcp_server_path,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Send initialization message
            init_message = {
                "jsonrpc": "2.0",
                "id": self.get_next_id(),
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "clientInfo": {
                        "name": "x402-langgraph-client",
                        "version": "1.0.0"
                    }
                }
            }
            
            await self._send_message(init_message)
            response = await self._receive_message()
            
            if response.get("error"):
                raise Exception(f"MCP initialization failed: {response['error']}")
                
            print("✅ Connected to LLM Wallet MCP server")
            return True
            
        except Exception as e:
            print(f"❌ Failed to connect to MCP server: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from the MCP server"""
        if self.process:
            self.process.terminate()
            await self.process.wait()
            self.process = None
            print("🔌 Disconnected from MCP server")
    
    def get_next_id(self) -> int:
        """Get next request ID"""
        self.request_id += 1
        return self.request_id
    
    async def _send_message(self, message: Dict[str, Any]):
        """Send a message to the MCP server"""
        if not self.process:
            raise Exception("Not connected to MCP server")
        
        message_str = json.dumps(message) + "\n"
        self.process.stdin.write(message_str.encode())
        await self.process.stdin.drain()
    
    async def _receive_message(self) -> Dict[str, Any]:
        """Receive a message from the MCP server"""
        if not self.process:
            raise Exception("Not connected to MCP server")
        
        line = await self.process.stdout.readline()
        if not line:
            raise Exception("Connection closed by server")
        
        return json.loads(line.decode().strip())
    
    async def _call_tool(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool on the MCP server"""
        message = {
            "jsonrpc": "2.0",
            "id": self.get_next_id(),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": params
            }
        }
        
        await self._send_message(message)
        response = await self._receive_message()
        
        if response.get("error"):
            raise Exception(f"Tool call failed: {response['error']}")
        
        return response.get("result", {})
    
    async def check_wallet_balance(self, network: str = "polygon-amoy") -> Dict[str, Any]:
        """Check current wallet balance"""
        try:
            result = await self._call_tool("wallet_balance", {"network": network})
            content = result.get("content", [{}])[0]
            return json.loads(content.get("text", "{}"))
        except Exception as e:
            print(f"❌ Failed to check balance: {e}")
            return {"error": str(e)}
    
    async def get_payment_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get payment history"""
        try:
            result = await self._call_tool("wallet_history", {"limit": limit})
            content = result.get("content", [{}])[0]
            return json.loads(content.get("text", "[]"))
        except Exception as e:
            print(f"❌ Failed to get payment history: {e}")
            return []
    
    async def call_x402_api(
        self, 
        url: str, 
        method: str = "GET", 
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        max_amount: Optional[str] = None
    ) -> X402PaymentResult:
        """
        Make an x402-protected API call.
        
        Args:
            url: The API endpoint URL
            method: HTTP method (GET, POST, etc.)
            params: Query parameters or request body
            headers: Additional headers
            max_amount: Maximum payment amount in USDC
            
        Returns:
            X402PaymentResult with success status and data
        """
        try:
            # Prepare payment configuration
            payment_config = {}
            if max_amount:
                payment_config["maxAmount"] = max_amount
                payment_config["network"] = "polygon-amoy"
            
            # Call the x402_pay tool
            result = await self._call_tool("x402_pay", {
                "resourceUrl": url,
                "method": method,
                "params": params or {},
                "headers": headers or {},
                "maxAmount": max_amount,
                "network": "polygon-amoy"
            })
            
            content = result.get("content", [{}])[0]
            response_text = content.get("text", "")
            
            # Parse the response
            try:
                response_data = json.loads(response_text)
                return X402PaymentResult(
                    success=True,
                    data=response_data,
                    payment_amount=response_data.get("payment_amount"),
                    transaction_hash=response_data.get("transaction_hash")
                )
            except json.JSONDecodeError:
                # Response might be plain text
                return X402PaymentResult(
                    success=True,
                    data={"response": response_text}
                )
                
        except Exception as e:
            return X402PaymentResult(
                success=False,
                error=str(e)
            )


# Convenience function for simple API calls
async def call_paid_api(
    url: str,
    params: Optional[Dict[str, Any]] = None,
    max_amount: Optional[str] = "0.01"
) -> X402PaymentResult:
    """
    Convenience function to call a paid API with x402.
    
    Args:
        url: The API endpoint URL
        params: Query parameters
        max_amount: Maximum payment amount in USDC
        
    Returns:
        X402PaymentResult with the API response
    """
    client = X402MCPClient()
    try:
        await client.connect()
        result = await client.call_x402_api(url, "GET", params, max_amount=max_amount)
        return result
    finally:
        await client.disconnect()


# Example usage
if __name__ == "__main__":
    async def test_client():
        client = X402MCPClient()
        
        try:
            # Connect to MCP server
            await client.connect()
            
            # Check balance
            balance = await client.check_wallet_balance()
            print(f"💰 Wallet balance: {balance}")
            
            # Get payment history
            history = await client.get_payment_history()
            print(f"📜 Payment history: {len(history)} transactions")
            
            # Make a paid API call
            result = await client.call_x402_api(
                "http://localhost:4021/weather",
                "GET",
                {"city": "London"},
                max_amount="0.001"
            )
            
            if result.success:
                print(f"✅ API call successful: {result.data}")
                if result.payment_amount:
                    print(f"💳 Paid: {result.payment_amount} USDC")
            else:
                print(f"❌ API call failed: {result.error}")
                
        finally:
            await client.disconnect()
    
    # Run the test
    asyncio.run(test_client())
