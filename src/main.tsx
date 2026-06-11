import { render } from "preact";
import { Game } from "./app/game";
import { App } from "./ui/App";

async function bootstrap(): Promise<void> {
  const host = document.getElementById("game")!;
  const uiRoot = document.getElementById("ui")!;

  const game = new Game();
  await game.init(host);
  render(<App game={game} />, uiRoot);

  if (import.meta.env.DEV) {
    (window as unknown as { __urbania: Game }).__urbania = game;
  }
}

void bootstrap();
