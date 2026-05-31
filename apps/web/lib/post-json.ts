interface ApiErrorPayload {
  error?: string;
  retryAfterSeconds?: number;
  [key: string]: unknown;
}

export class ApiRequestError extends Error {
  status: number;
  payload: ApiErrorPayload | null;

  constructor(message: string, status: number, payload: ApiErrorPayload | null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }

  get retryAfterSeconds(): number | null {
    const value = this.payload?.retryAfterSeconds;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return null;
    }
    return Math.floor(value);
  }
}

export async function postJson<TResponse>(url: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let errorPayload: ApiErrorPayload | null = null;
    try {
      const data = (await response.json()) as ApiErrorPayload;
      errorPayload = data;
      if (data.error) {
        message = data.error;
      }
    } catch {
      // Keep default message when response body is not JSON.
    }
    throw new ApiRequestError(message, response.status, errorPayload);
  }

  return (await response.json()) as TResponse;
}
