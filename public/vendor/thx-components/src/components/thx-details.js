// @ts-check

/**
 * @fileoverview THX 1138 styled details/summary disclosure component
 * @module thx-details
 */

import { LitElement, html, css } from '../../vendor/lit.js';

/**
 * Details disclosure component with THX 1138 styling
 * Clinical expandable sections with phosphor glow on open
 * @element thx-details
 */
export class ThxDetails extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: rgba(0, 0, 0, 0.02);
      margin: calc(var(--size-2) + var(--size-1)) 0;
      border-left: var(--border-size-2) solid transparent;
      transition: border-color var(--duration-moderate-1);
    }

    :host([open]) {
      border-left-color: var(--details-open-border, var(--atmos-primary, #a6c8e1));
      background: rgba(166, 200, 225, 0.03);
    }

    summary {
      padding: calc(var(--size-2) + var(--size-1)) var(--size-3);
      font-size: var(--font-size-0);
      font-family: var(--font-mono, 'Courier New', Courier, monospace);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-2);
      color: var(--neutral-800, #333);
      cursor: pointer;
      font-weight: var(--font-weight-5);
      list-style: none;
      display: flex;
      align-items: center;
      gap: calc(var(--size-2) + var(--size-1));
      user-select: none;
      transition: color var(--duration-quick-2);
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary::before {
      content: '▸';
      display: inline-block;
      font-size: var(--font-size-0);
      color: var(--atmos-secondary, #707e91);
      transition:
        transform var(--duration-moderate-1),
        color var(--duration-moderate-1);
      width: calc(var(--size-2) + var(--size-1));
      text-align: center;
    }

    :host([open]) summary::before {
      transform: rotate(90deg);
      color: var(--atmos-primary, #a6c8e1);
    }

    :host([open]) summary {
      color: var(--atmos-primary, #a6c8e1);
      border-bottom: var(--border-size-1) solid rgba(166, 200, 225, 0.2);
      text-shadow: 0 0 var(--size-2) rgba(166, 200, 225, 0.3);
    }

    summary:hover {
      color: var(--atmos-primary, #a6c8e1);
    }

    summary:hover::before {
      color: var(--atmos-primary, #a6c8e1);
    }

    .content {
      padding: var(--size-3);
      font-size: var(--font-size-1);
      color: var(--neutral-600, #666);
      line-height: var(--font-lineheight-4);
    }

    /* Disabled state */
    :host([disabled]) {
      opacity: 0.5;
      pointer-events: none;
    }

    :host([disabled]) summary {
      cursor: not-allowed;
    }

    /* Label suffix indicator */
    .label-suffix {
      margin-left: auto;
      font-size: var(--font-size-0);
      color: var(--neutral-600, #666);
      letter-spacing: var(--font-letterspacing-4);
    }
  `;

  /**
   * @type {import('lit').PropertyDeclarations}
   */
  static properties = {
    open: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    suffix: { type: String },
  };

  constructor() {
    super();
    /** @type {boolean} Whether details is expanded */
    this.open = false;
    /** @type {boolean} Whether details is disabled */
    this.disabled = false;
    /** @type {string} Optional label suffix (like protocol number) */
    this.suffix = '';
  }

  /**
   * Toggle open state
   * @returns {void}
   */
  toggle() {
    if (this.disabled) return;
    this.open = !this.open;
    this._dispatchToggle();
  }

  /**
   * Dispatch toggle event
   * @returns {void}
   * @private
   */
  _dispatchToggle() {
    this.dispatchEvent(
      new CustomEvent('details-toggle', {
        bubbles: true,
        composed: true,
        detail: { open: this.open },
      })
    );
  }

  /**
   * Handle summary click
   * @param {MouseEvent} e
   * @returns {void}
   * @private
   */
  _handleSummaryClick(e) {
    e.preventDefault();
    this.toggle();
  }

  /**
   * @returns {import('lit').TemplateResult}
   */
  render() {
    return html`
      <summary @click="${this._handleSummaryClick}">
        <slot name="summary">PROTOCOL DETAILS</slot>
        ${this.suffix ? html`<span class="label-suffix">${this.suffix}</span>` : ''}
      </summary>
      ${this.open
        ? html`
            <div class="content">
              <slot></slot>
            </div>
          `
        : ''}
    `;
  }
}

customElements.define('thx-details', ThxDetails);
