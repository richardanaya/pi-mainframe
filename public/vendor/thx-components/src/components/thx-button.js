// @ts-check

/**
 * @fileoverview THX 1138 styled button component
 * @module thx-button
 */

import { LitElement, html, css } from '../../vendor/lit.js';

/**
 * @typedef {Object} ButtonProps
 * @property {string} variant - The button variant (primary, secondary, warning, error, outline-primary, outline-secondary, outline-warning, ghost)
 * @property {string} size - The button size (sm, md, lg)
 * @property {boolean} disabled - Whether the button is disabled
 * @property {boolean} loading - Whether the button shows loading state
 * @property {string} type - The button type (button, submit, reset)
 */

/**
 * THX 1138 styled button component
 * @extends {LitElement}
 */
export class ThxButton extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-mono, 'Courier New', Courier, monospace);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-4);
      border: none;
      cursor: pointer;
      transition: all var(--duration-quick-2);
      position: relative;
      overflow: hidden;
      font-weight: var(--font-weight-6);
    }

    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* Sizes */
    .size-sm {
      padding: var(--size-1) calc(var(--size-2) + var(--size-1));
      font-size: var(--font-size-00);
      height: var(--size-6);
    }

    .size-md {
      padding: var(--size-2) var(--size-4);
      font-size: var(--font-size-0);
      height: calc(var(--size-7) + var(--size-2));
    }

    .size-lg {
      padding: var(--size-3) var(--size-6);
      font-size: var(--font-size-0);
      height: var(--size-8);
    }

    /* Grouped - for use in button groups */
    :host([grouped]) {
      display: block;
    }

    :host([grouped]) button {
      border-radius: 0;
      width: 100%;
      height: calc(var(--size-7) + var(--size-1));
      padding: var(--size-2) var(--size-3);
    }

    :host([grouped]) .size-sm {
      height: var(--size-6);
      padding: var(--size-1) calc(var(--size-2) + var(--size-1));
    }

    :host([grouped]) .size-lg {
      height: 44px;
      padding: calc(var(--size-2) + var(--size-1)) var(--size-5);
    }

    /* Primary */
    .variant-primary {
      background: var(--atmos-primary, #a6c8e1);
      color: var(--neutral-800, #333);
    }

    .variant-primary:hover:not(:disabled) {
      background: var(--atmos-tertiary, #deffff);
      box-shadow: 0 0 15px rgba(166, 200, 225, 0.5);
    }

    /* Secondary */
    .variant-secondary {
      background: var(--atmos-secondary, #707e91);
      color: var(--neutral-100, #fafafa);
    }

    .variant-secondary:hover:not(:disabled) {
      background: var(--atmos-primary, #a6c8e1);
      color: var(--neutral-800, #333);
    }

    /* Warning */
    .variant-warning {
      background: var(--accent-warning, #d4aa00);
      color: var(--neutral-800, #333);
    }

    .variant-warning:hover:not(:disabled) {
      box-shadow: 0 0 15px rgba(212, 170, 0, 0.5);
    }

    /* Error */
    .variant-error {
      background: var(--accent-error, #d44000);
      color: var(--neutral-100, #fafafa);
    }

    .variant-error:hover:not(:disabled) {
      box-shadow: 0 0 15px rgba(212, 64, 0, 0.5);
    }

    /* Outline variants */
    .variant-outline-primary {
      background: transparent;
      color: var(--atmos-primary, #a6c8e1);
      border: var(--border-size-1) solid var(--atmos-primary, #a6c8e1);
    }

    .variant-outline-primary:hover:not(:disabled) {
      background: var(--atmos-primary, #a6c8e1);
      color: var(--neutral-800, #333);
    }

    .variant-outline-secondary {
      background: transparent;
      color: var(--atmos-secondary, #707e91);
      border: var(--border-size-1) solid var(--atmos-secondary, #707e91);
    }

    .variant-outline-secondary:hover:not(:disabled) {
      background: var(--atmos-secondary, #707e91);
      color: var(--neutral-100, #fafafa);
    }

    .variant-outline-warning {
      background: transparent;
      color: var(--accent-warning, #d4aa00);
      border: var(--border-size-1) solid var(--accent-warning, #d4aa00);
    }

    .variant-outline-warning:hover:not(:disabled) {
      background: var(--accent-warning, #d4aa00);
      color: var(--neutral-800, #333);
    }

    /* Ghost */
    .variant-ghost {
      background: transparent;
      color: var(--neutral-600, #666);
      border: var(--border-size-1) solid transparent;
    }

    .variant-ghost:hover:not(:disabled) {
      color: var(--atmos-primary, #a6c8e1);
      border-color: var(--atmos-primary, #a6c8e1);
    }

    /* Loading state */
    .loading {
      pointer-events: none;
    }

    .loading::after {
      content: '';
      width: calc(var(--size-2) + var(--size-1));
      height: calc(var(--size-2) + var(--size-1));
      border: var(--border-size-2) solid transparent;
      border-top-color: currentColor;
      border-radius: var(--radius-round);
      margin-left: var(--size-2);
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    button:active:not(:disabled) {
      transform: translateY(1px);
    }
  `;

  static properties = {
    variant: { type: String },
    size: { type: String },
    disabled: { type: Boolean },
    loading: { type: Boolean },
    type: { type: String },
    /** When true, adjusts styling for use in button groups */
    grouped: { type: Boolean, reflect: true },
  };

  constructor() {
    super();
    /** @type {string} */
    this.variant = 'primary';
    /** @type {string} */
    this.size = 'md';
    /** @type {boolean} */
    this.disabled = false;
    /** @type {boolean} */
    this.loading = false;
    /** @type {string} */
    this.type = 'button';
    /** @type {boolean} */
    this.grouped = false;
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  handleClick(event) {
    if (this.disabled || this.loading) {
      event.preventDefault();
    }
  }

  /**
   * @returns {import('lit').TemplateResult}
   */
  render() {
    const classes = `size-${this.size} variant-${this.variant} ${this.loading ? 'loading' : ''}`;
    return html`
      <button
        class=${classes}
        ?disabled=${this.disabled || this.loading}
        type=${this.type}
        @click=${this.handleClick}
      >
        <slot></slot>
      </button>
    `;
  }
}

customElements.define('thx-button', ThxButton);
