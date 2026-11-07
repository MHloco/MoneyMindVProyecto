import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Obligation } from '../../services/obligation.services';

@Component({
  selector: 'app-obligation-card', standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './obligation-card.html', styleUrl: './obligation-card.scss'
})
export class ObligationCardComponent {
  @Input({ required: true }) obligation!: Obligation;
  @Output() open = new EventEmitter<Obligation>();
}
