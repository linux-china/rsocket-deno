import {RemoteBroadcastChannel} from "./remote-channel.ts";

const channel = new RemoteBroadcastChannel("tcp://0.0.0.0:42252");
channel.onmessage = message => {
    console.log(message);
}
console.log("BroadcastChannel listening on tcp://0.0.0.0:42252")
