import * as signalR from '@microsoft/signalr';

class SignalRManager {
    public connection: signalR.HubConnection | null = null;
    public activePlayers: string[] = [];
    public liveScores: Record<string, number> = {};
    
    // Callbacks
    public onPlayersUpdated?: (players: string[]) => void;
    public onScoreUpdated?: (username: string, score: number) => void;

    public async connect(username: string) {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl("/gamehub") // Proxied
            .withAutomaticReconnect()
            .build();

        this.connection.on("ActivePlayersList", (players: string[]) => {
            this.activePlayers = players;
            if (this.onPlayersUpdated) this.onPlayersUpdated(players);
        });

        this.connection.on("LiveScoreUpdate", (data: { username: string, score: number }) => {
            this.liveScores[data.username] = data.score;
            if (this.onScoreUpdated) this.onScoreUpdated(data.username, data.score);
        });

        this.connection.on("PlayerJoined", (u: string) => console.log(u, "joined"));
        this.connection.on("PlayerLeft", (u: string) => console.log(u, "left"));

        try {
            await this.connection.start();
            await this.connection.invoke("JoinGame", username);
            console.log("Connected to SignalR GameHub");
        } catch (err) {
            console.error("SignalR Connection Error: ", err);
        }
    }

    public async sendScore(score: number) {
        if (this.connection?.state === signalR.HubConnectionState.Connected) {
            await this.connection.invoke("SendLiveScore", score);
        }
    }
}

export const signalRClient = new SignalRManager();
