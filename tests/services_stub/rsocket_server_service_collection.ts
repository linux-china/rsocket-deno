import {
    RSocketServer,
    RSocket,
    ConnectionSetupPayload,
    RSocketRouteHandler
} from "../../mod.ts"

//RSocket Service
class UserService {

    async findNickById(id: number): Promise<string> {
        return "DenoServer";
    }
}

const server = await RSocketServer.create({
    accept(setup: ConnectionSetupPayload, sendingSocket: RSocket) {
        return RSocketRouteHandler.fromHandler("com.example.UserService", new UserService());
    }
}).bind("tcp://127.0.0.1:42252");

