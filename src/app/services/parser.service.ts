import { Injectable } from '@angular/core';
import { Diagram } from '../classes/diagram/diagram';
import { Element } from '../classes/diagram/element';
import { Line } from '../classes/diagram/line';
import { Coords, JsonPetriNet } from '../classes/json-petri-net';
import { JsonExport } from './json-export.service';
import { Place } from '../classes/diagram/place';
import { Transition } from '../classes/diagram/transition';

@Injectable({
    providedIn: 'root'
})
export class ParserService {

    parse(text: string): Diagram | undefined {
        try {
            const rawData = JSON.parse(text) as JsonPetriNet;

            const places = this.createPlaces(rawData['places'], rawData['layout']);
            const transitions = this.createTransitions(rawData['transitions'], rawData['layout']);
            const arcs = rawData['arcs'] as JsonPetriNet['arcs'];

            if(places && transitions && arcs){
                const lines = this.createLines(rawData['layout'], places, transitions, arcs)
                
                return new Diagram(places, transitions, lines);
            }
            return
            
        } catch (e) {
            console.error('Error while parsing JSON', e, text);
            return undefined;
        }
    }


    private createLines(layout: JsonPetriNet['layout'], places: Array<Place>, transitions: Array<Transition>, arcs: JsonPetriNet['arcs']): Array<Line> {
        const lines: Array<Line> = [];
        
        
        if (arcs) {
            // let arcCounter = 0;
            for (const arc in arcs) {
                //sourceTarget[0] -> SourceID || sourceTarget[1] -> TargetID
                const sourceTarget = arc.split(','); 
                if (arc.startsWith('p')) { //Place
                    const line = new Line(arc, places.find(pid => pid.id === sourceTarget[0]) as Element, transitions.find(tid => tid.id === sourceTarget[1]) as Element);
                    line.createSVG();
                    lines.push(line);
                } else { //Transition
                    const line = new Line(arc, transitions.find(tid => tid.id === sourceTarget[0]) as Element, places.find(pid => pid.id === sourceTarget[1]) as Element);
                    line.createSVG();
                    lines.push(line);
                }
                // arcCounter++;
            }
            if (layout) {
                //Loop through layout and check if entry is an array
                for (const pid in layout) {
                    const coords = layout[pid];
                    if (Array.isArray(coords)) {
                        //Loop through each line and search for same id
                        lines.forEach(line => {
                            if (line.id === pid) {
                                //Loop through each found coordinate (intermediate point) and create temporary var
                                const intermediates: Coords[] = [];
                                coords.forEach(coord => {
                                    intermediates.push({x: coord.x, y: coord.y});
                                });
                                //Save temporary var within line to
                                line.coords = intermediates;
                            }
                        });                  
                    }
                }
            }
        }
        return lines;
    }

    private createPlaces(placeIds: Array<string> | undefined, layout: JsonPetriNet['layout']): Place[] | undefined {
        if (layout === undefined || placeIds === undefined) {
            return;
        }
        let places = []
        for (const id of placeIds) {
            const pos = layout[id] as Coords | undefined;
            if (pos !== undefined) {
                const place = new Place(id, pos.x, pos.y)
                place.createSVG()
                places.push(place)
              
            }
        }
        return places;
    }

    private createTransitions(transitionIds: Array<string> | undefined, layout: JsonPetriNet['layout']): Transition[] | undefined {
        if (layout === undefined || transitionIds === undefined) {
            return;
        }
        let transitions = []
        for (const id of transitionIds) {
            const pos = layout[id] as Coords | undefined;
            if (pos !== undefined) {
                const transition = new Transition(id, pos.x, pos.y)
                transition.createSVG()
                transitions.push(transition)
              
            }
        }
        return transitions;
    }
}
