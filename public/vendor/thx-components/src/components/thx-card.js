// @ts-check

/**
 * @fileoverview THX 1138 styled card component for content containers.
 * @module thx-card
 */

import { LitElement, html, css } from '../../vendor/lit.js';

/**
 * @typedef {Object} CardConfig
 * @property {string} label - Card label/header
 * @property {boolean} crt - Whether to use CRT display styling
 * @property {boolean} hoverable - Whether card has hover effects
 */

/**
 * Card component for content containers.
 * Styled with THX 1138 monochrome aesthetic.
 *
 * @extends {LitElement}
 */
export class ThxCard extends LitElement {
  /** @type {import('lit').CSSResult} */
  static styles = css`
    :host {
      display: block;
    }

    .card {
      background: var(--neutral-100, #fafafa);
      padding: var(--size-7);
      box-shadow: var(--inner-shadow-0);
      position: relative;
    }

    .card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--size-5);
      padding-bottom: calc(var(--size-2) + var(--size-1));
      border-bottom: var(--border-size-1) solid rgba(0, 0, 0, 0.08);
    }

    .card__label {
      font-family: var(--font-mono, 'Courier New', Courier, monospace);
      font-size: var(--font-size-0);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-5);
      color: var(--neutral-600, #666);
    }

    .card__actions {
      display: flex;
      gap: var(--size-2);
    }

    .card__content {
      position: relative;
      font-family: var(--font-mono, 'Courier New', Courier, monospace);
      font-size: var(--font-size-1);
      line-height: var(--font-lineheight-4, 1.6);
      color: var(--neutral-800, #333);
    }

    .card--hoverable {
      transition: box-shadow var(--duration-moderate-1);
      cursor: pointer;
    }

    .card--hoverable:hover {
      box-shadow:
        var(--inner-shadow-1),
        0 0 15px rgba(166, 200, 225, 0.3);
    }

    /* CRT Display Variant */
    .card--crt {
      background: var(--crt-bg, #111);
      border: calc(var(--size-2) + var(--size-1)) solid var(--crt-border, #2a2a2a);
      border-radius: var(--size-1);
      box-shadow: inset 0 0 var(--size-4) rgba(0, 0, 0, 0.5);
      padding: var(--size-4);
      color: var(--atmos-primary, #a6c8e1);
      overflow: hidden;
    }

    .card--crt .card__header {
      border-bottom-color: rgba(166, 200, 225, 0.2);
    }

    .card--crt .card__label {
      color: var(--atmos-secondary, #707e91);
    }

    .card--crt::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(166, 200, 225, 0.04) 2px,
        rgba(166, 200, 225, 0.04) var(--size-1)
      );
      pointer-events: none;
      z-index: var(--layer-2);
      animation: scanlines var(--duration-pause) linear infinite;
    }

    @keyframes scanlines {
      0% {
        transform: translateY(0);
      }
      100% {
        transform: translateY(4px);
      }
    }

    .card--crt::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.4) 100%);
      pointer-events: none;
      z-index: calc(var(--layer-2) + 1);
    }

    .card--crt .card__content {
      position: relative;
      z-index: var(--layer-1);
    }

    /* Inner border decoration */
    .card__inner-border {
      position: absolute;
      inset: var(--size-1);
      border: var(--border-size-1) solid rgba(0, 0, 0, 0.04);
      pointer-events: none;
    }

    .card--crt .card__inner-border {
      border-color: rgba(166, 200, 225, 0.1);
    }

    @media (prefers-reduced-motion: reduce) {
      .card--crt::before {
        animation: none;
      }
    }
  `;

  /**
   * @returns {import('lit').PropertyDeclarations}
   */
  static get properties() {
    return {
      /** Card label/header text */
      label: { type: String },
      /** Whether to use CRT display styling */
      crt: { type: Boolean, reflect: true },
      /** Whether card has hover effects */
      hoverable: { type: Boolean, reflect: true },
    };
  }

  constructor() {
    super();
    /** @type {string} */
    this.label = '';
    /** @type {boolean} */
    this.crt = false;
    /** @type {boolean} */
    this.hoverable = false;
  }

  /**
   * Render the card component.
   * @returns {import('lit').TemplateResult}
   */
  render() {
    const cardClasses = {
      card: true,
      'card--crt': this.crt,
      'card--hoverable': this.hoverable,
    };

    const classString = Object.entries(cardClasses)
      .filter(([_, value]) => value)
      .map(([key]) => key)
      .join(' ');

    return html`
      <div class="${classString}">
        <div class="card__inner-border"></div>
        ${this.label
          ? html`
              <div class="card__header">
                <span class="card__label">${this.label}</span>
                <div class="card__actions">
                  <slot name="actions"></slot>
                </div>
              </div>
            `
          : null}
        <div class="card__content">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

customElements.define('thx-card', ThxCard);
