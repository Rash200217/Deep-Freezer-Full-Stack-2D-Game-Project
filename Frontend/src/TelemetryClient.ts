import { TelemetryActivityClient } from './telemetry.client';
import { GrpcWebFetchTransport } from '@protobuf-ts/grpcweb-transport';

const transport = new GrpcWebFetchTransport({
    baseUrl: ""
});

const client = new TelemetryActivityClient(transport);

export const TelemetryClient = {
    async sendEvent(userId: string, eventType: string, entityId: number = 0) {
        try {
            await client.reportEvent({
                userId,
                eventType,
                timestamp: BigInt(Date.now()),
                entityId
            });
            console.log(`Telemetry sent: ${eventType} by ${userId}`);
        } catch (e) {
            console.error("Failed to send gRPC telemetry", e);
        }
    }
};
