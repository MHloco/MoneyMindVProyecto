import { Component, HostListener } from '@angular/core';

@Component({
  selector: 'app-home-hero',
  standalone: true,
  templateUrl: './home-hero.html',
  styleUrl: './home-hero.scss'
})
export class HomeHeroComponent {
  angle = 0;
  private dragging = false;
  private startAngle = 0;
  private baseAngle = 0;

  /** Rota la V arrastrándola alrededor de su centro. */
  @HostListener('pointerdown', ['$event'])
  onPointerDown(e: PointerEvent): void {
    const stage = this.getStage(e);
    if (!stage) return;

    this.dragging = true;
    this.startAngle = this.angleFrom(e, stage);
    this.baseAngle = this.angle;
    stage.setPointerCapture(e.pointerId);
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(e: PointerEvent): void {
    const stage = this.getStage(e);
    if (!this.dragging || !stage) return;

    this.angle = this.baseAngle + (this.angleFrom(e, stage) - this.startAngle);
  }

  @HostListener('pointerup')
  @HostListener('pointercancel')
  onPointerUp(): void {
    this.dragging = false;
  }

  private getStage(e: PointerEvent): HTMLElement | null {
    return (e.target as HTMLElement).closest('.v-stage') as HTMLElement | null;
  }

  private angleFrom(e: PointerEvent, el: HTMLElement): number {
    const { top, left, width, height } = el.getBoundingClientRect();
    return (Math.atan2(e.clientY - (top + height / 2), e.clientX - (left + width / 2)) * 180) / Math.PI;
  }
}
