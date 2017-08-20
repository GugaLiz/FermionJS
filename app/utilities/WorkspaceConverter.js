const PAD_LENGTH = 3;
const WORKSPACE_ID = 'workspace';
const TOP_LEVEL_NAME = 'App';
const { appParser, flattenStateProps } = require('./propsRecursor');
const { cloneDeep } = require('lodash');
const { getChildEvents, flattenEvents } = require('./eventsRecursor');
/**
* @param {object} state - a flattened version of the state object and all component's props - rolled into one object for exporting the state.
* @param {object} stateMap - an object containing all state and props values in a semi-flattened state. each component will be represented by a key pointing to its ID in the store, and its props will be lifted up into the statemap as an object at that key.
* @param {object} events - similar to state, a compressed version of event listeners to be injected into props chain from the top-level down.
* @param {object} eventsMap - similar to stateMap, but for events.
* @param {object} methods - a list of methods applied in app class to be spread to eventhandlers.
*/

let state;
let stateMap;
let events;
let eventsMap;
let methods;
//    https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
if (!String.prototype.padStart) {
  String.prototype.padStart = function padStart(targetLength, padString) {
    targetLength >>= 0; // floor if number or convert non-number to 0;
    padString = String(padString || ' ');
    if (this.length > targetLength) {
      return String(this);
    }

    targetLength -= this.length;
    if (targetLength > padString.length) {
      padString += padString.repeat(targetLength / padString.length); // append to original to ensure we are longer than needed
    }
    return padString.slice(0, targetLength) + String(this);
  };
}

const padName = (name, id) => `${name}_${id.padStart(PAD_LENGTH, '0')}`;

class ComponentConverter {
  constructor(component, components) {
    this.component = component;
    this.components = components;
    this.events = component.events;
    console.log('events: ', this.events);
    this.children = components[component.id].children;
  }
  get ext() {
    return '.js';
  }
  get fileName(){
    if (this.component.id === WORKSPACE_ID){
      return TOP_LEVEL_NAME;
    }
    return padName(this.component.name, this.component.id.toString())
  }
  get id() {
    return this.component.id;
  }
  get name() {
    return this.component.name;
  }

  getEvents() {
    return Object.keys(this.events).reduce((events, event) => {
     if (this.component.children.indexOf(Number(event)) === -1){
       events += `${event}=`;
       events += `{${this.events[event]}} `;
     }
     return events;
   }, '');
  }
  getImports() {
    return this.component.childrenFileNames.reduce((final, childFile) => {
      final += `import ${childFile} from '../${childFile}/${childFile}'` + '\n';
      return final;
    }, '');
  }
  getChildren() {
    return this.component.childrenFileNames.reduce((final, childFile, i, array) => {
      // console.log(childFile);
      final += `        <${childFile}\n ${this.getChildProps(childFile)} /> `;
      // if (i === array.length - 1) final += '\n';
      final += '\n';
      return final;
    }, '\n');
  }
  getClass() {
    return `${this.component.name}`;
  }
  getStyle() {
    let style;
    if (!this.component.props){
      style = {height: '100vh', width:'100vw', 'backgroundColor': '#FFF', 'margins': '0px'};
    } else {
      style = this.component.props.style;
    }
    return JSON.stringify(style);
  }

    // obj destructures props in render method automatically.
  destructureProps() {
    let props;
    let events;
    if (this.component.id !== WORKSPACE_ID){
      props = flattenStateProps(this.component.props, this.component.id, this.components);
      events = flattenEvents(this.component.events, this.component.id, this.components);
      props = Object.assign(props, events);
    } else {
      return '';
    }
    delete props.style;
    const destructuredProps = Object.keys(props).reduce((final, key) => {
      final += `${key}, `;
      return final;
    }, 'const { ');
    return destructuredProps.slice(0, destructuredProps.length - 2) + ' } = this.props;'
  }
    //adds child props to component calls in JSX.
  getChildProps(childFile) {
    const child = parseInt(childFile.slice(-3));
    let childProps;
    let childEvents;
    if (this.component.id !== WORKSPACE_ID){
        childProps = cloneDeep(this.component.props[child]);
        childEvents = cloneDeep(this.component.events[child]);
    } else {
      childProps = flattenStateProps(this.components[child].props, String(child), this.components);
      childEvents = flattenEvents(this.components[child].events, String(child), this.components);
    }
    childProps = Object.assign(childProps, childEvents);
    delete childProps.style;
    return Object.keys(childProps).reduce((inline, prop) => {
      inline+= `        ${prop}={${childProps[prop]}}\n`;
      return inline;
    }, '');
  }

  generateCode() {
    const className = this.getClass();
    return (
      `
      import React, { Component } from 'react'
      ${this.getImports()}
      const divStyle = ${this.getStyle()}
      class ${className} extends Component {
        constructor(props){
          super(props);
        ${className === 'App' ? `this.state = ${state.replace(/\"/g, "")}` : `` }
        }
        render(){
          ${this.destructureProps()}
          return (
            <div style={divStyle}  ${this.getEvents()}>
              ${this.getChildren()}
            </div>
          )
        }
      }
      export default ${className};
      `
    );
  }
}
class WorkspaceConverter {
  constructor(workspace){
    const clonedWorkspace = appParser(workspace);
    let comps = Object.assign({}, clonedWorkspace.components);
    stateMap = JSON.stringify(Object.assign({}, clonedWorkspace.state));
    eventsMap = JSON.stringify(Object.assign({}, clonedWorkspace.components.workspace.events));
    state = JSON.stringify(Object.assign({}, flattenStateProps(clonedWorkspace.state, 'workspace', clonedWorkspace.components)), '  ');
    comps[WORKSPACE_ID].name = TOP_LEVEL_NAME;
    this.components = this.convertChildIDtoFileName(comps);
  }
  convertChildIDtoFileName(components){
    let converted = Object.keys(components).reduce((acc, id)=>{
      let newComponent = Object.assign({}, components[id]);
      newComponent.childrenFileNames = components[id].children.map(childID =>{
        return padName(components[childID].name, components[childID].id.toString())
      });
      acc[id] = newComponent;
      return acc;
    }, {});
    return converted;
  }
  convert(){
    return Object.keys(this.components).reduce((acc, key)=>{
      const cc = new ComponentConverter(this.components[key], this.components);
      acc.push({
        name: cc.name,
        id: cc.id,
        fileName: cc.fileName,
        ext: cc.ext,
        code: cc.generateCode() });
      return acc;
    }, []);
  }
}
module.exports = WorkspaceConverter;
