# InfiniteBuild
无限Build可能的游戏


## 应用层与展示接口

依赖关系：`mockapp → GameApp → GameInterface + GameUI → Battlefield`。

- `app` 的 `GameInterface` 定义所需的状态读取、构筑变更、关卡创建、结算、战利品和教程记录能力。core 的 `Game` 无需声明 `implements`，传入 GameApp 时由 TypeScript 按结构校验兼容性。当前接口为同步调用。
- `app` 的 `GameApp` 接收 `GameInterface`，负责计时器、战斗推进、装备操作、教程完成判断、自动结算和 UI 更新。
- `ui` 的 `GameUI` 统一管理界面，接收动态快照并通过回调表达操作意图。Battlefield 为其私有成员。
- `renderer` 的 `Battlefield` 在创建时接收固定配置，更新时只接收战斗展示状态。
- `mockapp` 提供数据、完整游戏画布及画布尺寸预览工具，不包含游戏调试面板、外部游戏操作或战斗循环。

```ts
import { Game } from "@infinite-build/core";
import { GameApp } from "@infinite-build/app";

const app = await GameApp.create({ canvas, gameData, game: new Game(gameData) });
// 创建后自动显示开始页，所有操作通过游戏内 UI 完成。
window.addEventListener("pagehide", () => app.destroy(), { once: true });
```

GameApp 对外仅提供 `create()` 和 `destroy()`，构造函数和游戏操作均为私有。计时器、教程、装备、关卡切换和结算由应用内部管理。注入的 Game 实现应与游戏定义一致；当前通过 `GameInterface` 同步调用。

运行 `pnpm mock` 或 `pnpm mock:web` 启动游戏页面。运行 `pnpm run build` 构建所有包，运行 `pnpm --filter @infinite-build/app test` 验证应用生命周期与游戏流程。
