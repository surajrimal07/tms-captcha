import type { IndexKey, SocketRoom } from "./interface";

//make type of data later to all posible data types
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type MessageCallback = (data: any, type?: IndexKey) => void;

export class NepseWebSocket {
	private static instance: NepseWebSocket | null = null;
	public ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectTimeout = 1000;
	private messageHandlers = new Map<SocketRoom, MessageCallback>();

	constructor(
		private baseUrl: string,
		private rooms: SocketRoom[],
		private indexes?: IndexKey[],
	) {
		this.connect();
	}

	public static getInstance(
		baseUrl: string,
		rooms: SocketRoom[],
		indexes?: IndexKey[],
		reconnect = false,
	): NepseWebSocket {
		const hasConfigChanged =
			!NepseWebSocket.instance ||
			NepseWebSocket.instance.baseUrl !== baseUrl ||
			JSON.stringify(NepseWebSocket.instance.rooms) !== JSON.stringify(rooms) ||
			JSON.stringify(NepseWebSocket.instance.indexes) !==
				JSON.stringify(indexes);

		if (reconnect && NepseWebSocket.instance && hasConfigChanged) {
			NepseWebSocket.instance.close();
			NepseWebSocket.instance = null;
		}

		if (!NepseWebSocket.instance || hasConfigChanged) {
			if (!baseUrl || !rooms.length) {
				throw new Error("Invalid socket configuration");
			}
			NepseWebSocket.instance = new NepseWebSocket(baseUrl, rooms, indexes);
		}
		return NepseWebSocket.instance;
	}

	private connect() {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			return;
		}

		const queryParams = new URLSearchParams();
		queryParams.set("subscribe", this.rooms.join(","));

		if (this.indexes?.length) {
			queryParams.set("index", this.indexes.join(","));
		}

		const url = `${this.baseUrl}?${queryParams.toString()}`;

		this.ws = new WebSocket(url);

		this.ws.onopen = this.handleOpen.bind(this);
		this.ws.onmessage = (event: MessageEvent) => {
			try {
				const { event: room, data, type } = JSON.parse(event.data);
				const handler = this.messageHandlers.get(room as SocketRoom);
				if (handler) {
					handler(data, type);
				}
			} catch (error) {
				console.error("Error parsing message:", error);
			}
		};
		this.ws.onclose = this.handleClose.bind(this);
		this.ws.onerror = this.handleError.bind(this);
	}

	public onMessage(room: SocketRoom, callback: MessageCallback) {
		this.messageHandlers.set(room, callback);
	}

	private handleOpen() {
		this.reconnectAttempts = 0;
	}

	private handleClose() {
		this.tryReconnect();
	}

	private handleError(error: Event) {
		console.error("WebSocket error:", error);
	}

	private tryReconnect() {
		if (this.ws) return;

		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error("Max reconnection attempts reached");
			return;
		}

		this.reconnectAttempts++;
		const timeout = this.reconnectTimeout * 2 ** (this.reconnectAttempts - 1);

		setTimeout(() => {
			this.connect();
		}, timeout);
	}

	public close() {
		if (this.ws) {
			this.ws.onopen = null;
			this.ws.onmessage = null;
			this.ws.onclose = null;
			this.ws.onerror = null;

			this.ws.close();
			this.ws = null;
		}
	}
}
