// @ts-check

/**
 * @fileoverview THX 1138 styled loading spinner component.
 * @module thx-spinner
 */

import { LitElement, html, css } from '../../vendor/lit.js';

/**
 * @typedef {Object} SpinnerConfig
 * @property {string} size - Spinner size: 'sm' | 'md' | 'lg' | 'xl'
 * @property {string} variant - Visual variant: 'default' | 'crt' | 'warning' | 'error'
 * @property {string} spinnerStyle - Spinner visual style: 'circle' | 'dots' | 'bars' | 'pulse'
 */

/**
 * Loading spinner component with multiple animation styles.
 * Styled with THX 1138 CRT/phosphor aesthetic.
 *
 * @extends {LitElement}
 */
export class ThxSpinner extends LitElement {
  /** @type {import('lit').CSSResult} */
  static styles = css`
    :host {
      display: inline-flex;
    }

    .spinner {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    /* Circle spinner */
    .spinner--circle {
      animation: rotate 1s linear infinite;
    }

    @keyframes rotate {
      100% {
        transform: rotate(360deg);
      }
    }

    .spinner--circle svg {
      fill: none;
    }

    .spinner--circle circle {
      fill: none;
      stroke: var(--neutral-600, #666);
      stroke-width: 2;
      stroke-dasharray: 60, 200;
      stroke-dashoffset: 0;
      stroke-linecap: square;
    }

    .spinner--circle.spinner--crt circle {
      stroke: var(--atmos-primary, #a6c8e1);
      filter: drop-shadow(0 0 var(--size-1) rgba(166, 200, 225, 0.6));
    }

    .spinner--circle.spinner--warning circle {
      stroke: var(--accent-warning, #d4aa00);
    }

    .spinner--circle.spinner--error circle {
      stroke: var(--accent-error, #d44000);
    }

    /* Dots spinner */
    .spinner--dots {
      display: flex;
      gap: var(--size-1);
    }

    .spinner--dots .dot {
      width: var(--size-2);
      height: var(--size-2);
      background: var(--neutral-600, #666);
      animation: dots 1.4s ease-in-out infinite both;
    }

    .spinner--dots.spinner--crt .dot {
      background: var(--atmos-primary, #a6c8e1);
      box-shadow: 0 0 var(--size-1) rgba(166, 200, 225, 0.6);
    }

    .spinner--dots.spinner--warning .dot {
      background: var(--accent-warning, #d4aa00);
    }

    .spinner--dots.spinner--error .dot {
      background: var(--accent-error, #d44000);
    }

    .spinner--dots .dot:nth-child(1) {
      animation-delay: -0.32s;
    }
    .spinner--dots .dot:nth-child(2) {
      animation-delay: -0.16s;
    }

    @keyframes dots {
      0%,
      80%,
      100% {
        transform: scale(0);
        opacity: 0.5;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }

    /* Bars spinner */
    .spinner--bars {
      display: flex;
      gap: var(--size-1);
      align-items: center;
    }

    .spinner--bars .bar {
      width: var(--size-1);
      background: var(--neutral-600, #666);
      animation: bars 1.2s ease-in-out infinite;
    }

    .spinner--bars.spinner--crt .bar {
      background: var(--atmos-primary, #a6c8e1);
      box-shadow: 0 0 var(--size-1) rgba(166, 200, 225, 0.6);
    }

    .spinner--bars.spinner--warning .bar {
      background: var(--accent-warning, #d4aa00);
    }

    .spinner--bars.spinner--error .bar {
      background: var(--accent-error, #d44000);
    }

    .spinner--bars .bar:nth-child(1) {
      animation-delay: -0.4s;
      height: calc(var(--size-2) + var(--size-1));
    }
    .spinner--bars .bar:nth-child(2) {
      animation-delay: calc(-1 * var(--duration-moderate-1));
      height: var(--size-3);
    }
    .spinner--bars .bar:nth-child(3) {
      animation-delay: 0s;
      height: calc(var(--size-2) + var(--size-1));
    }

    @keyframes bars {
      0%,
      100% {
        transform: scaleY(0.5);
        opacity: 0.5;
      }
      50% {
        transform: scaleY(1);
        opacity: 1;
      }
    }

    /* Pulse spinner */
    .spinner--pulse {
      position: relative;
    }

    .spinner--pulse::before,
    .spinner--pulse::after {
      content: '';
      position: absolute;
      border-radius: 0;
      background: var(--neutral-600, #666);
      opacity: 0.6;
      animation: pulse 2s ease-out infinite;
    }

    .spinner--pulse::after {
      animation-delay: 1s;
    }

    .spinner--pulse.spinner--crt::before,
    .spinner--pulse.spinner--crt::after {
      background: var(--atmos-primary, #a6c8e1);
    }

    @keyframes pulse {
      0% {
        transform: scale(0);
        opacity: 1;
      }
      100% {
        transform: scale(1);
        opacity: 0;
      }
    }

    /* Size variants */
    .spinner--sm.spinner--circle svg {
      width: var(--size-3);
      height: var(--size-3);
    }
    .spinner--md.spinner--circle svg {
      width: var(--size-5);
      height: var(--size-5);
    }
    .spinner--lg.spinner--circle svg {
      width: var(--size-7);
      height: var(--size-7);
    }
    .spinner--xl.spinner--circle svg {
      width: var(--size-8);
      height: var(--size-8);
    }

    .spinner--sm.spinner--dots .dot {
      width: var(--size-1);
      height: var(--size-1);
    }
    .spinner--lg.spinner--dots .dot,
    .spinner--xl.spinner--dots .dot {
      width: var(--size-2);
      height: var(--size-2);
    }

    .spinner--sm.spinner--pulse::before,
    .spinner--sm.spinner--pulse::after {
      width: calc(var(--size-2) + var(--size-1));
      height: calc(var(--size-2) + var(--size-1));
    }
    .spinner--md.spinner--pulse::before,
    .spinner--md.spinner--pulse::after {
      width: var(--size-4);
      height: var(--size-4);
    }
    .spinner--lg.spinner--pulse::before,
    .spinner--lg.spinner--pulse::after {
      width: var(--size-6);
      height: var(--size-6);
    }
    .spinner--xl.spinner--pulse::before,
    .spinner--xl.spinner--pulse::after {
      width: calc(var(--size-7) + var(--size-2));
      height: calc(var(--size-7) + var(--size-2));
    }
  `;

  /**
   * @returns {import('lit').PropertyDeclarations}
   */
  static get properties() {
    return {
      /** Spinner size: 'sm' | 'md' | 'lg' | 'xl' */
      size: { type: String, reflect: true },
      /** Visual variant: 'default' | 'crt' | 'warning' | 'error' */
      variant: { type: String, reflect: true },
      /** Spinner visual style: 'circle' | 'dots' | 'bars' | 'pulse' */
      spinnerStyle: { type: String, reflect: true, attribute: 'spinner-style' },
    };
  }

  constructor() {
    super();
    /** @type {string} */
    this.size = 'md';
    /** @type {string} */
    this.variant = 'default';
    /** @type {string} */
    this.spinnerStyle = 'circle';
  }

  /**
   * Render circle spinner.
   * @returns {import('lit').TemplateResult}
   * @private
   */
  _renderCircle() {
    /** @type {Record<string, number>} */
    const sizes = { sm: 16, md: 24, lg: 32, xl: 48 };
    const size = sizes[this.size] || 24;

    return html`
      <svg viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${(size - 4) / 2}"></circle>
      </svg>
    `;
  }

  /**
   * Render dots spinner.
   * @returns {import('lit').TemplateResult}
   * @private
   */
  _renderDots() {
    return html`
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    `;
  }

  /**
   * Render bars spinner.
   * @returns {import('lit').TemplateResult}
   * @private
   */
  _renderBars() {
    return html`
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
    `;
  }

  /**
   * Render pulse spinner.
   * @returns {import('lit').TemplateResult}
   * @private
   */
  _renderPulse() {
    return html``;
  }

  /**
   * Render the spinner component.
   * @returns {import('lit').TemplateResult}
   */
  render() {
    const classes = {
      spinner: true,
      [`spinner--${this.size}`]: true,
      [`spinner--${this.variant}`]: true,
      [`spinner--${this.spinnerStyle}`]: true,
    };

    const classString = Object.entries(classes)
      .filter(([_, value]) => value)
      .map(([key]) => key)
      .join(' ');

    /** @type {Record<string, () => import('lit').TemplateResult>} */
    const renderFn = {
      circle: this._renderCircle,
      dots: this._renderDots,
      bars: this._renderBars,
      pulse: this._renderPulse,
    };

    const content = renderFn[this.spinnerStyle]?.call(this) || this._renderCircle.call(this);

    return html`<div class="${classString}" role="status" aria-label="Loading">${content}</div>`;
  }
}

customElements.define('thx-spinner', ThxSpinner);
