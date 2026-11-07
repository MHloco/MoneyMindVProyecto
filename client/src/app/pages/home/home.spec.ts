import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeComponent } from './home';
import { SubscriptionService } from '../../services/subscription.services';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), { provide: SubscriptionService, useValue: { getPlans: () => of([]) } }],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
