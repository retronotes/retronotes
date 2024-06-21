import express, { Request, Response } from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { PrismaClient } from '@prisma/client';
import bodyParser from 'body-parser';
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8080;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const prisma = new PrismaClient();

// Message Queue using Map to store unique messages
const messageQueue = new Map<string, Retro>();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

type Retro = {
  id: string;
  user_id : string,
  retro_name: string;
  what_went_well: string[];
  what_went_wrong: string[];
  action_item: string[];
};

// WebSocket connection handling
wss.on('connection', (socket: WebSocket) => {
  socket.on('error', (error) => {
    console.error(`WebSocket error: ${error}`);
  });

  socket.on('message', async (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString()) as Retro;
      // Add message to queue or update existing message
      messageQueue.set(message.id, message);
      console.log(`Message added to queue: ${message.id}`);

       // Restart interval if queue was empty
       if (messageQueue.size === 1) {
        startProcessingInterval();
      }
    } catch (err) {
      console.log('Error parsing message:', err);
    }
  });
});

// Interval to process message queue
let processingInterval: NodeJS.Timeout | null = null;

function startProcessingInterval() {
  if (processingInterval === null) {
    processingInterval = setInterval(processMessageQueue, 1000);
    console.log('Processing interval started.');
  }
}

function stopProcessingInterval() {
  if (processingInterval !== null) {
    clearInterval(processingInterval);
    processingInterval = null;
    console.log('Processing interval stopped.');
  }
}

// Function to process message queue every second
async function processMessageQueue() {
  if (messageQueue.size === 0) {
    console.log('Message queue is empty. Stopping processing.');
    stopProcessingInterval();
    return;
  }

  const messagesToProcess = Array.from(messageQueue.values());
  messageQueue.clear(); // Clear the message queue

  try {
    // Process each message and store in database
    for (const message of messagesToProcess) {
      await prisma.retro.update({
        where: { id: message.id },
        data: {
          retro_name: message.retro_name,
          what_went_well: message.what_went_well,
          what_went_wrong: message.what_went_wrong,
          action_item: message.action_item,
        },
      });
    }

    console.log(`Processed ${messagesToProcess.length} message(s) from the queue.`);
  } catch (error) {
    console.error('Error processing message queue:', error);
  }
}

// Routes
app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to RetroNotes');
});

server.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
