export interface IJsonRpcRequst {
  id: string | number;
  jsonrpc: string;
  method: string;
  params: any[];
}

export interface IJsonRpcResponse<T> {
  id: string | number;
  jsonrpc: string;
  error?: {
    code: number;
    message: string;
  };
  result: T;
}

export class JsonrpcClient {
  public url: URL;
  private headers: any = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  constructor(url: string, username?: string, password?: string) {
    this.url = new URL(url);
    if (username && password) {
      this.headers.Authorization =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }
  }

  public async call<T>(method: string, ...params: any[]) {
    const response = await fetch(this.url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Math.floor(Math.random() * 1e4),
        method,
        params: params.filter((v) => v !== undefined),
      } as IJsonRpcRequst),
    });
    if (!response.ok) {
      throw new Error(`Response not ok: ${response.status}`);
    }
    const body: IJsonRpcResponse<T> = await response.json();
    if (body.error) {
      throw new Error(`Response error: ${body.error.message}`);
    }
    return body.result;
  }
}
