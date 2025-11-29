import {Server, Socket} from 'socket.io';
import {emitter} from "next/client";

interface ServerToClientEvents {
    emitEvents: (message: CurrentEventsMessage) => void;
}

interface ClientToServerEvents {
    setEvent: (request: SetEventRequest) => void;
}

interface InterServerEvents {
    ping: () => void;
}

interface SocketData {
    name: string;
    age: number;
}

interface CurrentEventsMessage {
    events: any[];
}

interface SetEventRequest {
    event: any;
}

const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>();

function handleConnection() {
    io.on("connection", (socket: Socket) => {
        io.of("/").adapter.on("join-room", (room, id) => {
            // TODO: Get current events.
            socket.emit("emitEvents", )
        });
        socket.on("setEvent", handleSetEvent);
    });
}

function handleSetEvent(message: SetEventRequest) {
    // TODO: Add DB call to save event.
    const weekNumber: string = message.event.weekNumber.toString();
    // TODO: Get current events.
    const events: any[] = [];
    const updateMessage: CurrentEventsMessage = {events: events}
    io.to(weekNumber).emit("emitEvents", updateMessage);
}