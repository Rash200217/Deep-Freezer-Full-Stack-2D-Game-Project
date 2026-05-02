using Grpc.Core;
using DeepFreezeBackend.Protos;

namespace DeepFreezeBackend.Services;

public class TelemetryService : TelemetryActivity.TelemetryActivityBase
{
    private readonly ILogger<TelemetryService> _logger;

    public TelemetryService(ILogger<TelemetryService> logger)
    {
        _logger = logger;
    }

    public override Task<TelemetryResponse> ReportEvent(GameEventRequest request, ServerCallContext context)
    {
        // In a real application, we would write this to a Time-Series Database or analytics store.
        _logger.LogInformation("Received Telemetry: User {UserId} performed {EventType} on Entity {EntityId} at {Timestamp}",
            request.UserId, request.EventType, request.EntityId, request.Timestamp);
        
        return Task.FromResult(new TelemetryResponse
        {
            Success = true
        });
    }
}
