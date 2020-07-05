export function RSocketService(serviceName: string, serviceVersion: string = "") {
    return function (target: Function) {
        target.prototype._rsocketServiceName = serviceName;
        target.prototype._rsocketServiceVersion = serviceVersion;
    };
}
