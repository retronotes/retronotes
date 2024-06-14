import express, { Request, Response } from "express";
import http from "http"
import WebSocket, { WebSocketServer } from 'ws';
import { PrismaClient } from '@prisma/client'
import bodyParser from "body-parser";
const app = express();
const PORT = process.env.PORT || 8080
const server = http.createServer(app)
const wss = new WebSocketServer({ server });
const prisma = new PrismaClient()

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
type Retro = {
  id?: string;
  retro_name: string,
  what_went_well: string[],
  what_went_wrong: string[],
  action_item: string[],
}

wss.on('connection', (socket: WebSocket) => {
  socket.on('error', (error) => {
    console.error(`WebSocket error: ${error}`);
  });

  socket.on('message', async (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString()) as Retro;
      if (message.id) {
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
    } catch (err) {
      console.log("error", err);
    }

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    });
  });
});

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.get('/retronote/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const retro = await prisma.retro.findUnique({
      where: {
        id: id,
      }
    })

    if (retro) {
      res.status(200).send(retro)
    } else {
      res.status(404).send({ error: "Retro not found" })
    }
  } catch (error) {
    res.status(500).send({ error: "Internal server error" })
  }
})
app.post('/retronote', async (req: Request, res: Response) => {
  try {
    const { retro_name } = req.body;
    const newRetro = await prisma.retro.create({
      data: {
        retro_name: retro_name,
        what_went_well: [],
        what_went_wrong: [],
        action_item: [],
      },
    });
    res.status(200).send({ data: newRetro, message: "New retronote is created succesfully" });
  } catch {
    res.status(500).send({ error: "Internal server error" })
  }
});

app.delete('/retronote/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const retro = await prisma.retro.delete({
      where: { id: id },
    });
    if (retro) {
      res.status(200).json({ message: 'Retro deleted successfully', retro });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/retronote', async (req: Request, res: Response) => {
  try {
    const result = await prisma.retro.deleteMany({});
    res.status(200).json({ message: 'All retros deleted successfully', count: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
})




