// @flow
import React, { Component } from 'react';
import styles from './photon.css';
import coreStyles from './Core.css';
import panelStyles from './Panels.css';

// returns renderable config Panel options.

export default function ConfigOption(props) {
  const { activeComponent, propKey, value, action, deleter, actionHandler, onClick } = props;
  return (
    <li className={`${styles['list-group-item']}  ${panelStyles.list}`}>
      <strong>{`${propKey}`}</strong>
      <strong> : </strong>
      <input
        className={`${panelStyles.editField}`}
        placeholder={`${value}`}
        onKeyPress={(event) => actionHandler(event, action, activeComponent, propKey)}
      />
      <div
        className={`${panelStyles.deleteKey}`}
        onClick={() => { onClick(deleter, activeComponent, propKey); }}
      >
        X
      </div>
    </li>
  );
}