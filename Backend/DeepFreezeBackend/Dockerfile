# ─────────────────────────────────────────
#  Stage 1: Build
# ─────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app

# Copy project file and restore dependencies
COPY *.csproj ./
RUN dotnet restore

# Copy all source files and publish
COPY . ./
RUN dotnet publish -c Release -o /app/out

# ─────────────────────────────────────────
#  Stage 2: Runtime
# ─────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Copy published output from build stage
COPY --from=build /app/out .

# Render assigns PORT dynamically — expose it
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "DeepFreezeBackend.dll"]
