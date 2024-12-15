export class Tooltip {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement("div");
    this.element.style.cssText = `
        position: fixed;
        display: none;
        background: rgba(33, 33, 33, 0.95);
        color: white;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 12px;
        pointer-events: none;
        z-index: 1000;
        transform: translate(-50%, -100%);
        margin-top: -8px;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(2px);
      `;
    document.body.appendChild(this.element);
  }

  show(x: number, y: number, content: string) {
    this.element.innerHTML = content;
    this.element.style.display = "block";

    const rect = this.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    let left = x;
    if (x + rect.width / 2 > viewportWidth) {
      left = viewportWidth - rect.width / 2;
    } else if (x - rect.width / 2 < 0) {
      left = rect.width / 2;
    }

    this.element.style.left = `${left}px`;
    this.element.style.top = `${y}px`;
  }

  hide() {
    this.element.style.display = "none";
  }

  destroy() {
    document.body.removeChild(this.element);
  }
}
