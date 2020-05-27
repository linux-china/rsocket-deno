import {RSocketConnector} from "../../rsocket/RSocketConnector.ts"
import {buildServiceStub} from "../../rsocket/RSocket.ts";

const rsocket = await RSocketConnector.create().connect("tcp://127.0.0.1:42252");

interface UserService {
    findNickById(id: number): Promise<string>;
}

const userService = buildServiceStub<UserService>(rsocket, "com.example.UserService")

let nick = await userService.findNickById(1);
console.log(nick)

