/** Host-only canvas sizing; game flow remains inside GameApp. */
export function setupCanvasPreview(canvas: HTMLCanvasElement): void {
  function element<T extends HTMLElement>(id: string): T {
    const result = document.getElementById(id);
    if (!result) throw new Error(`Missing element: ${id}`);
    return result as T;
  }

  const resolution = element<HTMLSelectElement>("resolution");
  const battlefieldViewport = element<HTMLDivElement>("battlefield-viewport");
  const battlefieldStage = element<HTMLDivElement>("battlefield-stage");
  const customResolution = element<HTMLDivElement>("custom-resolution");
  const customWidth = element<HTMLInputElement>("custom-width");
  const customHeight = element<HTMLInputElement>("custom-height");
  const customZoom = element<HTMLInputElement>("custom-zoom");
  const customZoomValue = element<HTMLOutputElement>("custom-zoom-value");
  const resizeHandle = element<HTMLButtonElement>("resolution-resize");
  let customSize = { width: 1024, height: 768 };
  let resizeDrag:
    | {
        pointerId: number;
        x: number;
        y: number;
        width: number;
        height: number;
        scale: number;
      }
    | undefined;

  function setCustomSize(width: number, height: number): void {
    width = Math.round(
      Math.min(
        2560,
        Math.max(256, Number.isFinite(width) ? width : customSize.width),
      ),
    );
    // Keep room for UI even at the battlefield's widest allowed aspect ratio.
    const minHeight = Math.max(320, Math.ceil((width * 9) / 21) + 160);
    height = Math.round(
      Math.min(
        2560,
        Math.max(
          minHeight,
          Number.isFinite(height) ? height : customSize.height,
        ),
      ),
    );
    customSize = { width, height };
    customWidth.value = String(width);
    customHeight.value = String(height);
    customHeight.min = String(minHeight);
  }

  function applyResolution(): void {
    const selected = resolution.selectedOptions[0];
    const dimensions = resolution.value.match(/^(\d+)x(\d+)$/);
    const availableWidth = Math.max(1, battlefieldViewport.clientWidth);
    const availableHeight = Math.max(1, window.innerHeight * 0.8);
    const mobile = window.matchMedia("(max-width: 700px)").matches;
    const custom = resolution.value === "custom";
    customResolution.hidden = resizeHandle.hidden = !custom;
    battlefieldViewport.dataset.custom = String(custom);
    const width = custom
      ? customSize.width
      : dimensions
        ? Number(dimensions[1])
        : mobile
          ? 390
          : 1024;
    const height = custom
      ? customSize.height
      : dimensions
        ? Number(dimensions[2])
        : mobile
          ? 844
          : 768;
    const scale = custom
      ? Number(customZoom.value) / 100
      : Math.min(1, availableWidth / width, availableHeight / height);
    customZoomValue.value = `${customZoom.value}%`;
    // Transform only the preview; Pixi keeps rendering at the selected dimensions.
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.transform = `scale(${scale})`;
    battlefieldStage.style.width = `${width * scale}px`;
    battlefieldStage.style.height = `${height * scale}px`;
    canvas.setAttribute(
      "aria-label",
      `像素战场、石板盘和背包 · ${selected?.textContent ?? "自适应"} · ${width} × ${height}`,
    );
  }
  applyResolution();
  resolution.addEventListener("change", () => {
    if (resolution.value === "custom") {
      setCustomSize(canvas.clientWidth, canvas.clientHeight);
      customZoom.value = String(
        Math.max(
          10,
          Math.floor(
            Math.min(
              1,
              battlefieldViewport.clientWidth / customSize.width,
              (window.innerHeight * 0.8) / customSize.height,
            ) * 100,
          ),
        ),
      );
    }
    applyResolution();
  });
  for (const input of [customWidth, customHeight]) {
    input.addEventListener("change", () => {
      setCustomSize(customWidth.valueAsNumber, customHeight.valueAsNumber);
      applyResolution();
    });
  }
  customZoom.addEventListener("input", applyResolution);
  resizeHandle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || resizeDrag) return;
    event.preventDefault();
    resizeHandle.focus();
    resizeDrag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ...customSize,
      scale: Number(customZoom.value) / 100,
    };
    resizeHandle.setPointerCapture(event.pointerId);
  });
  resizeHandle.addEventListener("pointermove", (event) => {
    if (!resizeDrag || resizeDrag.pointerId !== event.pointerId) return;
    setCustomSize(
      resizeDrag.width + (event.clientX - resizeDrag.x) / resizeDrag.scale,
      resizeDrag.height + (event.clientY - resizeDrag.y) / resizeDrag.scale,
    );
    applyResolution();
  });
  function endResize(): void {
    const pointerId = resizeDrag?.pointerId;
    resizeDrag = undefined;
    if (pointerId !== undefined && resizeHandle.hasPointerCapture(pointerId))
      resizeHandle.releasePointerCapture(pointerId);
  }
  resizeHandle.addEventListener("pointerup", endResize);
  resizeHandle.addEventListener("pointercancel", endResize);
  resizeHandle.addEventListener("lostpointercapture", endResize);
  window.addEventListener("blur", endResize);
  resizeHandle.addEventListener("keydown", (event) => {
    const delta = event.shiftKey ? 50 : 10;
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    setCustomSize(
      customSize.width +
        (event.key === "ArrowRight"
          ? delta
          : event.key === "ArrowLeft"
            ? -delta
            : 0),
      customSize.height +
        (event.key === "ArrowDown"
          ? delta
          : event.key === "ArrowUp"
            ? -delta
            : 0),
    );
    applyResolution();
  });
  window.addEventListener("resize", applyResolution);
  const viewportObserver = new ResizeObserver(applyResolution);
  viewportObserver.observe(battlefieldViewport);
  window.addEventListener(
    "pagehide",
    () => {
      endResize();
      window.removeEventListener("blur", endResize);
      viewportObserver.disconnect();
      window.removeEventListener("resize", applyResolution);
    },
    { once: true },
  );
}
