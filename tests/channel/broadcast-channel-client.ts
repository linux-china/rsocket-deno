import {RemoteBroadcastChannel} from "./remote-channel.ts";

const channel = new RemoteBroadcastChannel("tcp://127.0.0.1:42252");
channel.post("hello");
channel.post("hello2");
channel.post("hello3");

console.log("messages sent!")
