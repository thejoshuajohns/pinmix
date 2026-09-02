export const styles = `
:host {
  all: initial;
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #111;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

[hidden] {
  display: none !important;
}

button,
input {
  font: inherit;
  color: inherit;
}

button {
  cursor: pointer;
  border: 0;
  border-radius: 999px;
  padding: 12px 18px;
  font-weight: 600;
  transition: background 0.15s;
}

:is(button, input, a):focus-visible {
  outline: 3px solid #0074e8;
  outline-offset: 2px;
}

.launcher {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #e60023;
  color: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.launcher:hover {
  background: #ad081b;
}

.launcher svg {
  width: 18px;
  height: 18px;
}

.card {
  width: min(340px, calc(100vw - 48px));
  padding: 20px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.card header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card header > div {
  min-width: 0;
}

.eyebrow {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #767676;
}

.card h2 {
  margin: 2px 0 0;
  overflow: hidden;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close {
  flex: none;
  padding: 4px 8px;
  background: transparent;
  font-size: 20px;
  line-height: 1;
}

.close:hover {
  background: #efefef;
}

.subtitle {
  margin: 4px 0 16px;
  color: #767676;
}

.form,
.progress,
.done {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-weight: 600;
}

.switch {
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
}

.switch input {
  flex: none;
  width: 18px;
  height: 18px;
  margin: 2px 0 0;
  accent-color: #e60023;
}

.switch small {
  display: block;
  font-size: 12px;
  font-weight: 400;
  color: #767676;
}

input {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #ddd;
  border-radius: 14px;
  background: #fff;
  font-weight: 400;
}

input:focus {
  outline: none;
  border-color: #e60023;
}

input[aria-invalid="true"] {
  border-color: #cc0000;
}

.primary {
  margin-top: 4px;
  background: #e60023;
  color: #fff;
}

.primary:hover {
  background: #ad081b;
}

.secondary {
  background: #efefef;
}

.secondary:hover {
  background: #e2e2e2;
}

.bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #efefef;
}

.fill {
  height: 100%;
  width: 0;
  border-radius: 999px;
  background: #e60023;
  transition: width 0.2s;
}

.open {
  display: block;
  padding: 12px 18px;
  border-radius: 999px;
  background: #e60023;
  color: #fff;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
}

.open:hover {
  background: #ad081b;
}

.error {
  color: #cc0000;
}

p {
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  button,
  .fill {
    transition: none;
  }
}
`;
