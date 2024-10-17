/*
 Copyright 2022 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

//const promiseUtils = await $arcgis.import("esri/core/promiseUtils");
const reactiveUtils = await $arcgis.import("esri/core/reactiveUtils");

import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";
import SignIn from './apl/SignIn.js';
import ViewLoading from './apl/ViewLoading.js';
import MapScale from './apl/MapScale.js';

class Application extends AppBase {

  /**
   * @type {Portal}
   */
  portal;

  /**
   *
   */
  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {

      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({app: this});
      applicationLoader.load().then(({portal, group, map, view}) => {
        //console.info(portal, group, map, view);

        // PORTAL //
        this.portal = portal;

        // SET APPLICATION DETAILS //
        this.setApplicationDetails({map, group});

        // STARTUP DIALOG //
        this.initializeStartupDialog();

        // VIEW SHAREABLE URL PARAMETERS //
        this.initializeViewShareable({view});

        // USER SIGN-IN //
        this.configUserSignIn();

        // APPLICATION //
        this.applicationReady({portal, group, map, view}).catch(this.displayError).then(() => {
          // HIDE APP LOADER //
          document.getElementById('app-loader').toggleAttribute('hidden', true);
          //console.info("Application ready...");
        });

      }).catch(this.displayError);
    }).catch(this.displayError);

  }

  /**
   *
   */
  configUserSignIn() {

    const signInContainer = document.getElementById('sign-in-container');
    if (signInContainer) {
      const signIn = new SignIn({container: signInContainer, portal: this.portal});
    }

  }

  /**
   *
   * @param view
   */
  configView({view}) {
    return new Promise(async (resolve, reject) => {
      if (view) {

        // VIEW AND POPUP //
        const Popup = await $arcgis.import("esri/widgets/Popup");
        view.set({
          constraints: {snapToZoom: false}
          /*popup: new Popup({
           dockEnabled: true,
           dockOptions: {
           buttonEnabled: false,
           breakpoint: false,
           position: "top-right"
           }
           })*/
        });

        // HOME //
        const Home = await $arcgis.import("esri/widgets/Home");
        const home = new Home({view});
        view.ui.add(home, {position: 'top-left', index: 0});

        // SEARCH //
        // const Search = await $arcgis.import("esri/widgets/Search");
        // const search = new Search({view: view});
        // view.ui.add(search, {position: 'top-left', index: 0});

        // COMPASS //
        const Compass = await $arcgis.import("esri/widgets/Compass");
        const compass = new Compass({view: view});
        view.ui.add(compass, {position: 'top-left', index: 2});
        reactiveUtils.watch(() => view.rotation, rotation => {
          compass.set({visible: (rotation > 0)});
        }, {initial: true});

        // MAP SCALE //
        const mapScale = new MapScale({view});
        view.ui.add(mapScale, {position: 'bottom-left', index: 0});

        // VIEW LOADING INDICATOR //
        const viewLoading = new ViewLoading({view: view});
        view.ui.add(viewLoading, 'bottom-right');

        // LAYER LIST //
        const LayerList = await $arcgis.import("esri/widgets/LayerList");
        const layerList = new LayerList({
          container: 'layers-container',
          view: view,
          visibleElements: {
            errors: true,
            statusIndicators: true
          }
        });

        // LEGEND //
        const Legend = await $arcgis.import("esri/widgets/Legend");
        const legend = new Legend({
          container: 'legend-container',
          view: view
        });
        //view.ui.add(legend, {position: 'bottom-left', index: 0});

        // BOOKMARKS //
        const Bookmarks = await $arcgis.import("esri/widgets/Bookmarks");
        const bookmarks = new Bookmarks({view: view});
        const Expand = await $arcgis.import("esri/widgets/Expand");
        const bookmarksExpand = new Expand({
          view: view,
          content: bookmarks,
          expanded: true
        });
        view.ui.add(bookmarksExpand, {position: 'top-left', index: 0});

        resolve();

      } else { resolve(); }
    });
  }

  /**
   *
   * @param portal
   * @param group
   * @param map
   * @param view
   * @returns {Promise}
   */
  applicationReady({portal, group, map, view}) {
    return new Promise(async (resolve, reject) => {
      // VIEW READY //
      this.configView({view}).then(async () => {

        await this.initializeKnowledgeGraph({view});
        await this.initializeEmployeeAssignment({view});
        await this.initializeShelterSelection({view});
        await this.initializeShelterAssignment({view});

        resolve();
      }).catch(reject);
    });
  }

  /**
   *
   * @param view
   * @return {Promise<void>}
   */
  async initializeKnowledgeGraph({view}) {

    // KNOWLEDGE GRAPH PORTAL ITEM //
    const PortalItem = await $arcgis.import('esri/portal/PortalItem');
    const kgPortalItem = new PortalItem({id: '7686c061cc1946ba9ed209ef30356d39'});
    await kgPortalItem.load();

    // KNOWLEDGE GRAPH //
    const knowledgeGraphService = await $arcgis.import('esri/rest/knowledgeGraphService');
    const knowledgeGraph = await knowledgeGraphService.fetchKnowledgeGraph(kgPortalItem.url);
    const Relationship = await $arcgis.import('esri/rest/knowledgeGraph/Relationship');
    //console.log(knowledgeGraph);

    // DEMO CLEANUP GRAPH GLOBAL IDS //
    const EMPLOYEE_GLOBAL_ID = "{C9B4E583-2280-471A-A957-97D38012F9D6}";
    const ROLE_GLOBAL_ID = "{FBE06ABE-3452-4713-8CAE-992BA5AC196C}";
    // DEMO CLEANUP //
    this.demoCleanup = async () => {
      return new Promise(async (resolve, reject) => {

        const openCypherQuery = `match (e:Employee) - [deleteme:AssignedTo] - (r:Role) where e.globalid = "${ EMPLOYEE_GLOBAL_ID }" and r.globalid = "${ ROLE_GLOBAL_ID }" return deleteme.globalid`;

        const {resultRows: result} = await knowledgeGraphService.executeQuery(knowledgeGraph, {openCypherQuery}).catch(this.displayError);
        const relationshipGlobalIDs = result?.at(0);
        if (relationshipGlobalIDs) {

          knowledgeGraphService.executeApplyEdits(knowledgeGraph, {
            relationshipDeletes: [{
              typeName: "AssignedTo",
              ids: relationshipGlobalIDs
            }]
          }).then(({editResults}) => {
            console.info("Cleanup: ", editResults?.at(0)?.deletes?.at(0)?.id);
            resolve();
          }).catch(reject);

        } else {resolve();}
      });
    };
    await this.demoCleanup().catch(this.displayError);

    /**
     *
     * @param {string} shelterID the ens_s_shelterid value
     * @return {Promise<*>}
     */
    this.getShelterGlobalID = async ({shelterID}) => {
      const openCypherQuery = `MATCH (s:Shelter {ENS_S_ShelterID:'${ shelterID }'}) RETURN s.globalid`;
      const {resultRows: results} = await knowledgeGraphService.executeQuery(knowledgeGraph, {openCypherQuery}).catch(this.displayError);
      return results;
    };

    /**
     *
     * @param {string} shelterID the ens_s_shelterid value
     * @return {Promise<void>}
     */
    this.getRequiredSkillsForShelter = async ({shelterID}) => {
      const openCypherQuery = `MATCH (s:Shelter {ENS_S_ShelterID:'${ shelterID }'})-[:RequiresRole]->(role:Role)-[:RequiresSkill]->(skill:Skill) WHERE NOT (role)<-[:AssignedTo]-(:Employee) RETURN role.RoleType, collect(skill.Name)`;
      const {resultRows: results} = await knowledgeGraphService.executeQuery(knowledgeGraph, {openCypherQuery}).catch(this.displayError);
      return results;
    };

    /**
     *
     * @param {string} shelterID the ens_s_shelterid value
     * @return {Promise<*>}
     */
    this.getPotentialCandidatesForShelter = async ({shelterID}) => {
      //const openCypherQuery = `MATCH (s:Shelter {ENS_S_ShelterID:'${ shelterID }'})-[:RequiresRole]->(role:Role)-[:RequiresSkill]->(skill:Skill) WHERE NOT (role)<-[:AssignedTo]-(:Employee) WITH s, role, COLLECT(DISTINCT skill.Name) AS ReqSkills MATCH (e:Employee)-[:HasSkill]->(skill2:Skill)<-[:RequiresSkill]-(role2:Role) MATCH (e)-[:HasCondition]->(c:Condition)<-[:RequiresCondition]-(s2) WHERE (e:Employee)-[:AssignedTo]->(:Role)<-[:RequiresRole]-(:Shelter {ENS_S_Shelter_Status: 'CLOSED'})-[:Nearby]-(:Shelter) AND id(role)=id(role2) AND id(s)=id(s2) WITH s, e, c, ReqSkills, COLLECT(DISTINCT skill2.Name) AS empSkills, esri.graph.ST_GeoDistance(e.shape, s.shape) * 0.000621371 AS distance_in_miles WHERE all(reqSkill IN ReqSkills WHERE reqSkill IN empSkills) RETURN e.globalid, e.EmployeeName, empSkills, c.Allergy AS Condition, toString(round(distance_in_miles * 100) / 100.0) AS MilesFromShelter ORDER BY MilesFromShelter`;

      const openCypherQuery = `      
        MATCH (s:Shelter {ENS_S_ShelterID: "${ shelterID }"})-[:RequiresRole]->(role:Role)-[:RequiresSkill]->(skill:Skill)
        WHERE NOT (role)<-[:AssignedTo]-(:Employee)
        WITH s, role, COLLECT(DISTINCT skill.Name) AS ReqSkills
        
        MATCH (e:Employee)-[:HasSkill]->(skill2:Skill)<-[:RequiresSkill]-(role2:Role)
        WHERE (e:Employee)-[:AssignedTo]->(:Role)<-[:RequiresRole]-(:Shelter {ENS_S_Shelter_Status: "CLOSED"})-[:Nearby]-(:Shelter)        
        AND id(role)=id(role2)
         
        WITH s,role, e, ReqSkills, COLLECT(DISTINCT skill2.Name) AS empSkills
        WHERE all(reqSkill IN ReqSkills WHERE reqSkill IN empSkills)
        RETURN role.RoleType, role.globalid, e.EmployeeName, e.globalid, empSkills order by e.EmployeeName limit 5
      `;

      const {resultRows: results} = await knowledgeGraphService.executeQuery(knowledgeGraph, {openCypherQuery}).catch(this.displayError);
      return results;
    };

    /**
     *
     * https://developers.arcgis.com/javascript/latest/api-reference/esri-rest-knowledgeGraphService.html#executeApplyEdits
     *
     *
     * @param employeeGlobalID
     * @param roleGlobalID
     * @return {Promise<any>}
     */
    this.assignEmployeeToRoleInGraph = async ({employeeGlobalID, roleGlobalID}) => {
      // console.info("Employee GID: ", employeeGlobalID, "Role GID: ", roleGlobalID);

      const newRelationship = new Relationship({
        originId: employeeGlobalID,
        typeName: "AssignedTo",
        destinationId: roleGlobalID,
        properties: {}
      });

      const {editResults} = await knowledgeGraphService.executeApplyEdits(knowledgeGraph, {
        relationshipAdds: [newRelationship]
      }).catch(this.displayError);

      return editResults?.at(0).adds[0].id;
    };

  }

  /**
   *
   * https://developers.arcgis.com/javascript/latest/api-reference/esri-rest-knowledgeGraph-KnowledgeGraph.html
   *
   * @param view
   */
  async initializeShelterAssignment({view}) {

    // SHELTERS LAYER //
    const sheltersLayer = view.map.allLayers.find(l => l.title === 'Active and Closed Shelters_UPDATED');
    await sheltersLayer.load();
    sheltersLayer.set({
      outFields: ['*'],
      popupEnabled: false
    });

    view.whenLayerView(sheltersLayer).then(sheltersLayerView => {

      // reactiveUtils.watch(() => sheltersLayerView.suspended, suspended => {
      //   console.info("Shelters Suspended: ", suspended);
      // }, {initial: true});

      reactiveUtils.on(() => view, 'pointer-move', async (pointerEvt) => {
        if (!sheltersLayerView.suspended) {
          const {results} = await view.hitTest(pointerEvt, {include: [sheltersLayer]});
          view.container.style.cursor = (results?.length) ? 'pointer' : 'default';
        }
      });

      let highlight;

      /*reactiveUtils.on(() => view, 'pointer-move', async (pointerEvt) => {
        if (!sheltersLayerView.suspended) {
          const {results} = await view.hitTest(pointerEvt, {include: [sheltersLayer]});
          if (results?.length) {
            highlight = sheltersLayerView.highlight(results.at(0).graphic);
          } else {
            highlight?.remove();
          }
        }
      });*/

      // USER CLICKS ON SHELTER FEATURE //
      reactiveUtils.on(() => view, 'immediate-click', async (clickEvt) => {
        if (!sheltersLayerView.suspended) {
          const {results} = await view.hitTest(clickEvt, {include: [sheltersLayer]});
          highlight?.remove();
          if (results?.length) {
            this.togglePanel('analysis', true);
            highlight = sheltersLayerView.highlight(results.at(0).graphic);
            this.shelterSelected({shelterFeature: results.at(0).graphic}).then(() => {});
          } else {
            this.togglePanel('analysis', false);
            this.shelterSelected({shelterFeature: null}).then(() => {});
          }
        }
      });

    });

  }

  /**
   *
   * @param view
   * @return {Promise<void>}
   */
  async initializeEmployeeAssignment({view}) {

    const assignAlert = document.getElementById('assign-alert');
    this.setShadowElementStyle(assignAlert, '.container', 'top', '25vh');

    const assignAlertEmpId = document.getElementById('assign-alert-emp-id');
    const assignAlertRoleType = document.getElementById('assign-alert-role-type');

    const employeeLayer = view.map.allLayers.find(l => l.title === 'County Employees Full Symbol');
    await employeeLayer.load();
    employeeLayer.set({outFields: ["*"]});

    const Graphic = await $arcgis.import("esri/Graphic");
    const assignmentGraphic = new Graphic({
      symbol: {
        type: 'simple-line',
        color: 'limegreen',
        style: 'short-dot',
        width: 3.5
      }
    });
    const GraphicsLayer = await $arcgis.import("esri/layers/GraphicsLayer");
    const assignmentLayer = new GraphicsLayer({
      title: 'Employee Role to Shelter Assignment',
      graphics: [assignmentGraphic]
    });
    view.map.add(assignmentLayer, 2);

    view.whenLayerView(employeeLayer).then(employeeLayerView => {

      let highlight;

      this.assignEmployeeToRole = async ({shelterFeature, employeeName, roleType, employeeGlobalID, roleGlobalID}) => {
        return new Promise(async (resolve, reject) => {

          employeeLayerView.queryFeatures({
            where: `(EmployeeName = '${ employeeName }')`,
            returnGeometry: true
          }).then(({features: [employeeFeature]}) => {

            highlight?.remove();
            highlight = employeeLayerView.highlight(employeeFeature);

            assignmentGraphic.set({
              geometry: {
                type: 'polyline',
                spatialReference: {wkid: 102100},
                paths: [
                  [
                    [employeeFeature.geometry.x, employeeFeature.geometry.y],
                    [shelterFeature.geometry.x, shelterFeature.geometry.y]
                  ]
                ]
              }
            });

          });

          assignAlertEmpId.innerText = employeeName;
          assignAlertRoleType.innerText = roleType;
          assignAlert.toggleAttribute('open', true);

          const relationshipID = await this.assignEmployeeToRoleInGraph({employeeGlobalID, roleGlobalID});
          console.info(`Assigned employee ${ employeeGlobalID } to role ${ roleGlobalID } via relationship ${ relationshipID }`);

          setTimeout(() => {
            assignAlert.toggleAttribute('open', false);
            resolve();
          }, 5000);
        });
      };

    });
  }

  /**
   *
   * @param view
   */
  async initializeShelterSelection({view}) {

    const countFormatter = new Intl.NumberFormat('default', {maximumFractionDigits: 0, minimumFractionDigits: 0});

    const shelterInfo = document.getElementById('shelter-info');
    const skillsList = document.getElementById('skills-list');
    const skillsNotice = document.getElementById('skills-notice');
    const skillsProgress = document.getElementById('skills-progress');
    const candidatesList = document.getElementById('candidates-list');
    const candidatesNotice = document.getElementById('candidates-notice');
    const candidatesProgress = document.getElementById('candidates-progress');

    /**
     *
     * @param shelterFeature
     */
    this.shelterSelected = async ({shelterFeature}) => {

      shelterInfo.innerHTML = '';
      skillsNotice.toggleAttribute('open', false);
      candidatesNotice.toggleAttribute('open', false);

      skillsList.replaceChildren();
      candidatesList.replaceChildren();

      if (shelterFeature) {
        //console.table(shelterFeature.attributes)

        const {
          name,
          ens_s_shelterid,
          ens_s_address,
          ens_s_city,
          ens_s_state,
          ens_s_shelter_type,
          ens_s_shelter_status,
          ens_s_capacity,
          petfriendly,
          ens_s_pet_capacity
        } = shelterFeature.attributes;

        const statusColor = (ens_s_shelter_status === 'ACTIVATED') ? 'limegreen' : 'crimson';

        // SHELTER INFO //
        const infos = [];
        infos.push(`<div style="font-size:larger;">${ name }</div>`);
        infos.push(`Address: ${ ens_s_address },  ${ ens_s_city }, ${ ens_s_state }<br>`);
        infos.push(`<p>This <em>${ ens_s_shelter_type }</em> shelter is currently <span style="color:${ statusColor }">${ ens_s_shelter_status }</span>, and has a capacity of <strong>${ countFormatter.format(ens_s_capacity) }</strong> people.`);
        if (petfriendly?.toLowerCase() === 'yes') {
          infos.push(` This shelter is pet friendly and can hold up to <strong>${ ens_s_pet_capacity }</strong> pets.</p>`);
        } else {
          infos.push(` This shelter DOES NOT accept pets</p>`);
        }
        shelterInfo.innerHTML = infos.join('');

        // GET MISSING SKILLS //
        skillsProgress.toggleAttribute('hidden', false);
        this.getRequiredSkillsForShelter({shelterID: ens_s_shelterid}).then((requiredSkillsInfos) => {
          skillsProgress.toggleAttribute('hidden', true);

          if (!requiredSkillsInfos?.length) {
            skillsNotice.toggleAttribute('open', true);

          } else {

            const skillsItems = requiredSkillsInfos.map((requiredSkillsInfo, requiredSkillsInfoIdx) => {
              const [roleType, skills] = requiredSkillsInfo;

              const idxChip = document.createElement('calcite-chip');
              idxChip.classList.add('chip-role-type');
              idxChip.setAttribute('slot', 'actions-start');
              idxChip.setAttribute('value', `idx-${ requiredSkillsInfoIdx }`);
              //idxChip.setAttribute('kind', 'brand');
              idxChip.innerText = String(requiredSkillsInfoIdx + 1);

              const skillsItem = document.createElement('calcite-list-item');
              skillsItem.setAttribute('value', `${ requiredSkillsInfoIdx }`);
              skillsItem.setAttribute('label', roleType);
              skillsItem.setAttribute('description', skills.join(' | '));
              skillsItem.append(idxChip);

              return skillsItem;
            });
            skillsList.replaceChildren(...skillsItems);

          }
        });

        // POTENTIAL CANDIDATES //
        candidatesProgress.toggleAttribute('hidden', false);
        this.getPotentialCandidatesForShelter({shelterID: ens_s_shelterid}).then((potentialCandidates) => {
          candidatesProgress.toggleAttribute('hidden', true);

          if (!potentialCandidates?.length) {
            candidatesNotice.toggleAttribute('open', true);

          } else {
            //console.table(potentialCandidates);

            const candidateItems = potentialCandidates.map((potentialCandidate, potentialCandidateIdx) => {
              const [roleType, roleGlobalID, employeeName, employeeGlobalID, skills] = potentialCandidate;

              const idxChip = document.createElement('calcite-chip');
              idxChip.setAttribute('slot', 'actions-start');
              idxChip.setAttribute('value', `idx-${ potentialCandidateIdx }`);
              idxChip.setAttribute('appearance', 'outline-fill');
              idxChip.setAttribute('kind', 'brand');
              idxChip.setAttribute('scale', 's');
              idxChip.innerText = String(potentialCandidateIdx + 1);

              const assignAction = document.createElement('calcite-action');
              assignAction.setAttribute('id', `action-${ potentialCandidateIdx }`);
              assignAction.setAttribute('slot', 'actions-end');
              assignAction.setAttribute('title', 'assign to this shelter');
              assignAction.setAttribute('icon', 'personal-homepage');
              //assignAction.toggleAttribute('disabled',(employeeName !== '315712'));
              assignAction.classList.toggle('no-action', (employeeName !== '315712'));
              assignAction.addEventListener('click', async () => {
                assignAction.toggleAttribute('active', true);
                assignAction.toggleAttribute('loading', true);
                await this.assignEmployeeToRole({shelterFeature, employeeName, roleType, employeeGlobalID, roleGlobalID});
                assignAction.toggleAttribute('loading', false);
                await this.shelterSelected({shelterFeature});
              });

              // const actionTooltip = document.createElement('calcite-tooltip');
              // actionTooltip.setAttribute('reference-element', `action-${potentialCandidateIdx}`);
              // actionTooltip.innerText = 'assign to this shelter';

              const candidateItem = document.createElement('calcite-list-item');
              candidateItem.setAttribute('value', employeeGlobalID);
              candidateItem.setAttribute('label', `Emp ID: ${ employeeName } | Phone (305-111-11xx)`);
              candidateItem.setAttribute('description', `Role: ${ roleType } | Matches skills: ${ skills.join(', ') }`);

              candidateItem.append(idxChip);
              //candidateItem.append(actionTooltip);
              candidateItem.append(assignAction);

              return candidateItem;
            });
            candidatesList.replaceChildren(...candidateItems);

          }

        });
      }
    };
  }

}

export default new Application();
