using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace DeepFreezeBackend.Hubs;

public class GameHub : Hub
{
    // Keeping track of connected users (for real-time presence)
    private static readonly ConcurrentDictionary<string, string> ActivePlayers = new();

    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (ActivePlayers.TryRemove(Context.ConnectionId, out var username))
        {
            await Clients.All.SendAsync("PlayerLeft", username);
            await BroadcastActivePlayers();
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinGame(string username)
    {
        ActivePlayers[Context.ConnectionId] = username;
        await Clients.All.SendAsync("PlayerJoined", username);
        await BroadcastActivePlayers();
    }

    public async Task SendLiveScore(long score)
    {
        if (ActivePlayers.TryGetValue(Context.ConnectionId, out var username))
        {
            await Clients.All.SendAsync("LiveScoreUpdate", new { Username = username, Score = score });
        }
    }

    private async Task BroadcastActivePlayers()
    {
        await Clients.All.SendAsync("ActivePlayersList", ActivePlayers.Values);
    }
}
