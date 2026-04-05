import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-image-crop',
  standalone: true,
  template: `
    @if (show) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" (click)="cancel()">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full" (click)="$event.stopPropagation()">
          <div class="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 class="font-semibold text-slate-800">Krop Gambar Profil</h3>
            <button (click)="cancel()" class="text-slate-400 hover:text-slate-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="p-5">
            <div class="relative bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center"
              style="height: 360px; touch-action: none;"
              (mousedown)="onDragStart($event)"
              (mousemove)="onDragMove($event)"
              (mouseup)="onDragEnd()"
              (mouseleave)="onDragEnd()"
              (touchstart)="onTouchStart($event)"
              (touchmove)="onTouchMove($event)"
              (touchend)="onDragEnd()"
              (wheel)="onWheel($event)">
              <canvas #canvas class="block max-w-full max-h-full"></canvas>
              <!-- Crop overlay -->
              <div class="absolute inset-0 pointer-events-none">
                <div class="absolute inset-0" style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.5);"></div>
                <div class="absolute rounded-full border-2 border-white"
                  [style.width.px]="cropSize" [style.height.px]="cropSize"
                  [style.left.px]="cropX" [style.top.px]="cropY"></div>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-4">
              <span class="text-xs text-slate-500">Zum:</span>
              <input type="range" [min]="minScale" [max]="maxScale" [step]="0.01" [(ngModel)]="scale"
                (input)="redraw()" class="flex-1 accent-yellow-500" />
              <span class="text-xs text-slate-500 w-10 text-right">{{ (scale * 100) | number:'1.0-0' }}%</span>
            </div>
          </div>
          <div class="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
            <button (click)="cancel()"
              class="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
              Batal
            </button>
            <button (click)="crop()"
              class="px-4 py-2 text-sm font-semibold text-black bg-yellow-400 rounded-lg hover:bg-yellow-500">
              Guna Gambar
            </button>
          </div>
        </div>
      </div>
    }
  `,
  imports: [FormsModule, DecimalPipe],
})
export class ImageCropComponent {
  @Input() show = false;
  @Output() cropped = new EventEmitter<Blob>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private img: HTMLImageElement | null = null;
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private offsetX = 0;
  private offsetY = 0;
  private startOffsetX = 0;
  private startOffsetY = 0;

  scale = 1;
  minScale = 0.1;
  maxScale = 3;
  cropSize = 220;
  cropX = 0;
  cropY = 0;

  loadImage(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        this.img = img;
        this.show = true;
        setTimeout(() => this.initCanvas(), 50);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  private initCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.img) return;

    const container = canvas.parentElement!;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    this.cropSize = Math.min(cw, ch) * 0.6;
    this.cropX = (cw - this.cropSize) / 2;
    this.cropY = (ch - this.cropSize) / 2;

    // Fit image so it covers the crop area
    const fitScale = Math.max(this.cropSize / this.img.width, this.cropSize / this.img.height);
    this.minScale = fitScale * 0.5;
    this.maxScale = fitScale * 5;
    this.scale = fitScale;

    this.offsetX = (cw - this.img.width * this.scale) / 2;
    this.offsetY = (ch - this.img.height * this.scale) / 2;

    this.redraw();
  }

  redraw(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.img) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = this.img.width * this.scale;
    const h = this.img.height * this.scale;
    ctx.drawImage(this.img, this.offsetX, this.offsetY, w, h);
  }

  onDragStart(e: MouseEvent): void {
    this.dragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.startOffsetX = this.offsetX;
    this.startOffsetY = this.offsetY;
  }

  onDragMove(e: MouseEvent): void {
    if (!this.dragging) return;
    this.offsetX = this.startOffsetX + (e.clientX - this.dragStartX);
    this.offsetY = this.startOffsetY + (e.clientY - this.dragStartY);
    this.redraw();
  }

  onDragEnd(): void {
    this.dragging = false;
  }

  onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      this.dragging = true;
      this.dragStartX = t.clientX;
      this.dragStartY = t.clientY;
      this.startOffsetX = this.offsetX;
      this.startOffsetY = this.offsetY;
    }
  }

  onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.dragging || e.touches.length !== 1) return;
    const t = e.touches[0];
    this.offsetX = this.startOffsetX + (t.clientX - this.dragStartX);
    this.offsetY = this.startOffsetY + (t.clientY - this.dragStartY);
    this.redraw();
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale + delta));
    this.redraw();
  }

  crop(): void {
    if (!this.img) return;
    const outputSize = 400;
    const out = document.createElement('canvas');
    out.width = outputSize;
    out.height = outputSize;
    const ctx = out.getContext('2d')!;

    // Calculate what portion of the source image is inside the crop circle
    const srcX = (this.cropX - this.offsetX) / this.scale;
    const srcY = (this.cropY - this.offsetY) / this.scale;
    const srcSize = this.cropSize / this.scale;

    ctx.drawImage(this.img, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize);

    out.toBlob(blob => {
      if (blob) this.cropped.emit(blob);
      this.show = false;
    }, 'image/jpeg', 0.9);
  }

  cancel(): void {
    this.show = false;
    this.cancelled.emit();
  }
}
