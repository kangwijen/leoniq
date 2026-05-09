import "dotenv/config"
import { WebSocketServer } from "ws"
import { runForever, WS_PORT } from "./logic"

const wss = new WebSocketServer({ port: WS_PORT })

void runForever(wss)
