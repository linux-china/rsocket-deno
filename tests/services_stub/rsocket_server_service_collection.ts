import {
    RSocketServer,
    RSocket,
    ConnectionSetupPayload
} from "../../mod.ts"
import {RSocketRouteHandler} from "../../rsocket/RSocket.ts";

//RSocket Service
class UserService {

    async findNickById(id: number): Promise<string> {
        return "DenoServer";
    }
}

const routeHandler = new RSocketRouteHandler();

routeHandler.addServices("com.example.UserService", new UserService());

const server = await RSocketServer.create({
    accept(setup: ConnectionSetupPayload, sendingSocket: RSocket) {
        return routeHandler;
    }
}).bind("tcp://127.0.0.1:42252");

