FROM golang:1.26-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /server ./cmd/server

FROM alpine:3.23
RUN apk add --no-cache ca-certificates tzdata && adduser -D app && mkdir /data && chown app:app /data
USER app
COPY --from=build /server /server
ENV PORT=8080 DATABASE_PATH=/data/app.sqlite
EXPOSE 8080
CMD ["/server"]
