import {Injectable} from '@angular/core';
import {Diagram} from "../classes/diagram/diagram";
import {DisplayService} from "./display.service";
import {Transition} from "../classes/diagram/transition";
import {Place} from "../classes/diagram/place";
import {Line} from "../classes/diagram/line";
import {coerceStringArray} from "@angular/cdk/coercion";
import {transition} from "@angular/animations";

@Injectable({
    providedIn: 'root'
})

export class MarkenspielService {

    private _diagram: Diagram | undefined;
    private currentActiveTransitions = new Map;
    private alreadUsedParents = new Map;
    private multitasking: boolean = false;
    private roundTripMap = new Map;

    constructor(
        private diplayService: DisplayService) {
        this.diplayService.diagram$.subscribe(diagram => {
            this._diagram = diagram;
        });
    }

    currentChosenTransitions: Array<Transition> = [];
    processChosing: boolean = false;

    // Marken und Gewichte setzen
    public addCircleToken() {
        if (!this._diagram?.selectedCircle) {
            return;
        }

        this._diagram.selectedCircle.amountToken++;

        this._diagram.selectedCircle.svgElement!.children[1].textContent =
            this._diagram.selectedCircle.amountToken.toString()

        return;
    }

    public removeCircleToken() {
        if (!this._diagram?.selectedCircle) {
            return;
        }
        this._diagram.selectedCircle.amountToken--;

        this._diagram.selectedCircle.svgElement!.children[1].textContent =
            this._diagram.selectedCircle.amountToken.toString()

        if (this._diagram.selectedCircle.amountToken <= 0) {
            this._diagram.selectedCircle.amountToken = 0;
            this._diagram.selectedCircle.svgElement!.children[1].textContent = ''
        }
        return;
    }

    public addLineToken() {

        if (!this._diagram?.selectedLine) {
            return;
        }
        this._diagram.selectedLine.tokens++;

        this._diagram.selectedLine.svgElement!.childNodes[3].textContent =
            this._diagram.selectedLine!.tokens.toString();

        this._diagram.selectedLine!.svgElement!.querySelector('text')!.setAttribute('stroke', 'blue');

        if (this._diagram.selectedLine!.tokens > 1) {
            this._diagram.selectedLine!.svgElement!.querySelector('circle')!.setAttribute('fill', 'white');
        } else {
            this._diagram.selectedLine!.svgElement!.querySelector('circle')!.setAttribute('fill', 'transparent');
        }

        return;
    }

    public removeLineToken() {
        if (!this._diagram?.selectedLine) {
            return;
        }

        this._diagram.selectedLine.tokens--;

        if (this._diagram.selectedLine.tokens <= 1) {
            this._diagram.selectedLine.tokens = 1;
            this._diagram.selectedLine.svgElement!.querySelector('circle')!.setAttribute('fill', 'transparent');
        }

        if (this._diagram.selectedLine.tokens > 1) {
            this._diagram.selectedLine.svgElement!.childNodes[3].textContent =
                this._diagram.selectedLine.tokens.toString();
        } else {
            this._diagram.selectedLine.svgElement!.childNodes[3].textContent = "";
        }

        return;
    }

    // Markenspiel
    public getPossibleActiveTransitions(): Array<Transition> {
        const startTransitions: Array<Transition> = [];
        const transitions = this._diagram?.transitions;
        const lines = this._diagram?.lines;

        if (transitions && lines) {
            transitions?.forEach((transition) => {
                const transitionTargetLines = lines.filter(line => line.target.id === transition.id);

                if (this.parentsHaveEnoughTokens(transition.parents, transitionTargetLines)) {

                    transition.isActive = true;
                    startTransitions.push(transition);
                }
                else {
                    transition.isActive = false;
                }
            });
        }

        let notActiveTransitions = transitions?.filter(transition => !transition.isActive);

        notActiveTransitions?.forEach((transition) => {
            this.setTransitionColor(transition, 'black');
        });

        return startTransitions;
    }

    private parentsHaveEnoughTokens(places: Array<Place>, lines: Array<Line>): boolean {
        if (!lines || lines.length === 0) {
            return false;
        }

        return lines.every((line) => {
            const matchingPlace = places.find(place => place.id === line.source.id);
            return matchingPlace && matchingPlace.amountToken >= line.tokens;
        });
    }

    public fireTransition(transition: Transition): Array<Transition> {
        const lines = this._diagram?.lines;

        const targetLine = lines?.filter(line => line.target.id === transition.id);

        if(!this.parentsHaveEnoughTokens(transition.parents, targetLine!)) {

            return this.getPossibleActiveTransitions();
        }

        transition.parents.forEach((place) => {
            const line = lines?.find(line => line.source.id === place.id && line.target.id === transition.id);

            this.subtractTokensFromPlace(place, line!.tokens);
        });

        transition.children.forEach((place) => {
            const line = lines?.find(line => line.source.id === transition.id && line.target.id === place.id);

            this.addTokensToPlace(place, line!.tokens);
        });

        return this.getPossibleActiveTransitions();
    }

    // Markenspiel mit Schritten
    // Aufräumen: Lokalen Array der gerade aktiven Transitionen leeren und alle Transitionen auf false setzen
    private cleanUp() {
        this.currentChosenTransitions.splice(0,this.currentChosenTransitions.length);
        this.currentActiveTransitions.clear();
        this.alreadUsedParents.clear();

        this._diagram?.transitions.forEach((transition) => {
            transition.isActive = false;
            this.setTransitionColor(transition, 'black');
        });
    }

    public showAll(){
        // 1. Aufräumen und Hilfsvariablen erstellen
        this.cleanUp();

        let transitions = this.getPossibleActiveTransitions(); // alle schaltbaren Transitionen holen
        const lines = this._diagram?.lines; // alle Kanten holen

        // 2. Zeigen des Schrittes
        transitions.forEach((transition) => {
            lines?.find(line => line.source.id === transition.id);
            transition.isActive = true;
            this.setTransitionColor(transition, 'green');
        });

        return transitions;
    }

    // Zeigt alle in einem Schritt gleichzeitig möglichen Transitionen
    public showStep() {
        // 1. Aufräumen und Hilfsvariablen erstellen
        this.cleanUp();
        let transitions = this.getPossibleActiveTransitions(); // alle schaltbaren Transitionen holen

        const lines = this._diagram?.lines; // alle Kanten holen
        let sourcePlaceIds: String[] = []; // Array für die schon verwendeten Stellen zur Prüfung im Wettbewerbskonflikt

        // 2. Array mischen
        this.shuffle(transitions);

        // 3. Prüfen auf Konflikte
        transitions.forEach((transition) => {
            const line = lines?.find(line => line.target.id === transition.id);
            let currentSourceID = line!.source.id;

            // Prüfen, ob die Stelle im Vorbereich schon von einer anderen Transition benutzt wurde
            if(!sourcePlaceIds.includes(currentSourceID)){
                this.currentChosenTransitions.push(transition);
                sourcePlaceIds.push(currentSourceID);
            }

            // else: Marken noch aufteilen
        });

        // 4. Zeigen des Schrittes
        this.currentChosenTransitions?.forEach((transition) => {
            lines?.find(line => line.source.id === transition.id);
            transition.isActive = true;
            this.setTransitionColor(transition, 'violet');
        });

        return;
    }

    // Aufruf zum Erstellen eines Schrittes
    public editStep() {
        // Aufräumen
        this.cleanUp();
        this.alreadUsedParents.clear();
        this.currentChosenTransitions = [];

        // parents nach Anzahl der Marken sortieren
        this._diagram?.transitions.forEach((element) => {
            let parents = element.parents;

            parents.sort(function(a,b) {
                return a.amountToken - b.amountToken;
            });
        });

        // console.log("edit step");
        // console.log("current chosen transitions");
        // console.log(this.currentChosenTransitions);
        // console.log("already used parents");
        // console.log(this.alreadUsedParents);

        let currentTransitions = this.showAll();
        currentTransitions.forEach((element) => {
           element.svgElement?.addEventListener(('dblclick'),  (choseElement) => {
               this.choseElement(element);
           });

           this.smallCleanUp(element,element.parents);
        });

        return;
    }

    // Aufruf zum Aktivieren von Auto-Cuncurrency
    public multitaskingTransitions(multitasking: boolean) {
        this.multitasking = multitasking;
        // Wenn in der Stelle vor der Transition genug Marken sind, kann die Transition so oft schalten, wie ihr
        // kleinstes Parent Marken hat
    }

    // Auswahl einer Transition für den Schritt
    public choseElement(element: Transition) {
        let parents = element.parents;

        // console.log(this.alreadUsedParents);
        // console.log(this.alreadUsedParents.get(element.parents[0].id));

        parents.sort(function(a,b) {
            return a.amountToken - b.amountToken;
        });

        // Einfacher Schritt ohne Auto-Cuncurrency
        if(!this.multitasking){
            this.simpleStep(element);
            console.log("simple step");
        }

        // Schritt mit Autocuncurrency ("multitasking")
        else {
            this.multiStep(element);

            console.log("multitasking");

            /*
            while(count > 0){

                if(this.checkConsequences(element) && this.processChosing){
                    // this.currentChosenTransitions.push(element);
                    // this.setTransitionColor(element,'violet');

                }
                count = count - result!.tokens;
            }*/
        }
    }

    // Auto-Concurrency
    private multiStep(element: Transition) {
        let lines = this._diagram?.lines;
        let transitions = this.getPossibleActiveTransitions();
        let sourcePlaceIds: String[] = []; // Array für die schon verwendeten Stellen zur Prüfung im Wettbewerbskonflikt

        let parents = element.parents;
        let number = this.setmultitaskingNumber(element);

        // console.log(number);

        parents.forEach((parent) => {
            let result = lines?.find(line => line.target.id === element.id && line.source.id === parent.id);
            let lineTokens = result!.tokens;
            let newTokenAmount;

            if(this.alreadUsedParents.has(parent.id)){
                let oldTokenAmount = this.alreadUsedParents.get(parent.id);
                newTokenAmount = oldTokenAmount - lineTokens
                console.log("new Token Amount: "+newTokenAmount)
            } else {
                newTokenAmount = parent.amountToken - lineTokens;
                console.log("new Token Amount/else: "+newTokenAmount)
            }

            this.alreadUsedParents.set(parent.id, newTokenAmount);

            console.log(this.alreadUsedParents);
        });


        while(number > 0){
            this.currentChosenTransitions.push(element);
            number = number - 1;
        }

        this.currentChosenTransitions.forEach((transition) => {
           this.setTransitionColor(transition,'violet');
        });


        /*
        transitions.forEach((transition) => {
            const line = lines?.find(line => line.target.id === transition.id);
            let currentSourceID = line!.source.id;

            // Prüfen, ob die Stelle im Vorbereich schon von einer anderen Transition benutzt wurde
            if(!sourcePlaceIds.includes(currentSourceID)){
                sourcePlaceIds.push(currentSourceID);
            }
        });*/

        // alle anderen Transitionen, die gleiche parents haben, dürfen jetzt nicht mehr aktiv sein

        console.log(this.currentChosenTransitions);
    }

    private setmultitaskingNumber(element: Transition) {
        let multitaskingNumber = 1000;
        let localMap = new Map;
        let localLineMap = new Map;
        let parents = element.parents;
        let lines = this._diagram?.lines;

        parents.forEach((parent) => {
            let result = lines?.find(line => line.target.id === element.id && line.source.id === parent.id);
            let lineTokens = result!.tokens;

            if(this.alreadUsedParents.has(parent.id)){
                localMap.set(parent.id, this.alreadUsedParents.get(parent.id));
            } else {
                localMap.set(parent.id, parent.amountToken);
            }

            localLineMap.set(parent.id,lineTokens);
        });

        // console.log(localMap);
        console.log(localLineMap);

        localLineMap.forEach((lineToken) => {

            localMap.forEach((parentToken) => {
                if( parentToken/lineToken < multitaskingNumber){
                    multitaskingNumber = parentToken/lineToken;
                }
            });
        });

        console.log("Number: "+multitaskingNumber);

        return multitaskingNumber;
    }


    // Überprüfung der Vorbedingungen und ggf. Hinzufügen der Transition zum Schritt
    private simpleStep(element: Transition) {
        if(this.checkParents(element) && this.processChosing){

            if(!this.currentChosenTransitions.includes(element)){
                let parents = element.parents;
                let lines = this._diagram!.lines;
                let localTokenArray: number[] = [];
                let transitionIsStillActive: boolean = false;

                parents.sort(function(a,b) {
                    return a.amountToken - b.amountToken;
                });

                parents.forEach((parent) => {
                    let parentToken = this.alreadUsedParents.get(parent.id);
                    localTokenArray.push(parentToken);

                    // console.log(parent.id+" mit insgesamt "+parent.amountToken);
                    // console.log(parent.id+" hat gerade "+parentToken);
                });

                // console.log(localTokenArray);
                if(!localTokenArray.includes(0)) {
                    // a) Berechnen der neuen Markenanzahl für alle Stellen
                    parents.forEach((parent) => {
                        // let roundTrip = this.roundTrip(element, parent);
                        let result = lines?.find(line => line.target.id === element.id && line.source.id === parent.id);
                        let idString = result!.id.split(',')![0];
                        // result: eingehende Kante, idString: Stelle, die vor der Kante steht (dazugehörige parent.id)

                        if (this.alreadUsedParents.has(idString) && this.alreadUsedParents.get(idString) - result!.tokens >= 0) {

                            let oldTokenAmount = this.alreadUsedParents.get(idString);
                            let newTokenAmount = oldTokenAmount - result!.tokens;

                            this.alreadUsedParents.set(idString, newTokenAmount);
                            transitionIsStillActive = true;

                            // console.log(parent.id+" hatte vorher: "+oldTokenAmount+" und hat jetzt "+newTokenAmount);

                        } else {
                            if(!this.alreadUsedParents.has(idString) && parent.amountToken - result!.tokens >= 0){

                                let newTokenAmount = parent.amountToken - result!.tokens;

                                this.alreadUsedParents.set(idString, newTokenAmount);
                                transitionIsStillActive = true;

                                // console.log("neu in already useed parents: "+idString+" mit "+newTokenAmount+" Marken");
                            }
                        }
                    });

                    // Hinzufügen der Transition zum Schritt
                    if(transitionIsStillActive){
                        this.currentChosenTransitions.push(element);
                        this.setTransitionColor(element,'violet');
                    } else {
                        this.setTransitionColor(element,'black');
                    }
                }
            }
        }
    }

    // Hilfsmethoden
    private getOccurence(array: Transition[], value: any) {
        return array.filter((v) => (v === value)).length;
    }

    private checkOnRoundTrips() {
        // sich im Kreis bewegende Marken erkennen
        // eingehende und ausgehende Kante holen
        // wenn gleich, dann ist maximales Count bei choseElement die Anzahl der Token in der dazugehörigen Stelle

        let allTransitions = this._diagram?.transitions;
        let lines = this._diagram!.lines;

        allTransitions?.forEach((transition) => {
            let parents = transition.parents;

            parents.forEach((parent) => {
                let inComingLine = lines!.find(line => line.target.id === transition.id && line.source.id === parent.id);
                let outGoingLine = lines!.find(line => line.source.id === transition.id && line.target.id === parent.id);

                if(inComingLine?.tokens == outGoingLine?.tokens){
                    this.roundTripMap.set(parent.id,parent.amountToken);
                }
            });
        });

        console.log(this.roundTripMap);
    }


    private smallCleanUp(element: Transition, parents: Place[]) {
        let deleteCount = parents[0].amountToken;
        let isChosen: boolean = false;

        if(element == this._diagram?.selectedRect){
            isChosen = true;
        } else {
            isChosen = false;
        }

        if(this.currentChosenTransitions.includes(element) && !isChosen){
            while(deleteCount > 0){

                let deleteElement = this.currentChosenTransitions.indexOf(element);
                this.currentChosenTransitions.splice(deleteElement);

                let possibleTransitions = this.getPossibleActiveTransitions();
                if(possibleTransitions.includes(element)){
                    this.setTransitionColor(element, 'green');
                } else {
                    this.setTransitionColor(element,'black');
                }

                deleteCount--;
            }
        }
    }

    private checkParents(element: Transition): boolean {
        let parentsHaveEnoughTokens: boolean = false;

        let parents = element.parents;
        let lines = this._diagram!.lines;

        parents.forEach((parent) => {
            let result = lines?.find(line => line.target.id === element.id && line.source.id === parent.id);
            let idString = result!.id.split(',')![0];
            // result: eingehende Kante
            // idString: Stelle, die vor der Kante steht (dazugehörige parent.id)

            if (this.alreadUsedParents.has(idString) && this.alreadUsedParents.get(idString) - result!.tokens >= 0){
                parentsHaveEnoughTokens = true;
            } else if (!this.alreadUsedParents.has(idString) && parent.amountToken - result!.tokens >= 0) {
                parentsHaveEnoughTokens = true;
            } else {
                parentsHaveEnoughTokens = false;
            }
        });

        return parentsHaveEnoughTokens;
    }



    checkConsequences(element: Transition) {
        let noConflicts = false;

        let parents = element.parents;
        let lines = this._diagram!.lines;

        parents.forEach((parent) => {
            let result = lines?.find(line => line.target.id === element.id && line.source.id === parent.id);
            let idString = result!.id.split(',')![0];
            // result: eingehende Kante
            // idString: Stelle, die vor der Kante steht (dazugehörige parent.id)

            if(!this.alreadUsedParents.has(idString)){

                console.log("neues Element hinzugefügt");

                noConflicts = true;

                // this.alreadUsedParents.set(idString, parent.amountToken - result!.tokens);

                console.log("Marken im Parent: ")
                console.log(this.alreadUsedParents.get(idString));

            }

            else if (this.alreadUsedParents.get(idString) - result!.tokens >= 0) {
                // Zuordnung?
                console.log("Element ist schon da, hat aber noch genug Marken");

                // this.alreadUsedParents.set(idString, this.alreadUsedParents.get(idString) - result!.tokens);

                console.log("Marken im Parent: ")
                console.log(this.alreadUsedParents.get(idString));

                noConflicts = true;
            }
            else {
                noConflicts = false;

                this.setTransitionColor(element, 'black');

                console.log("Element ist schon da und es gibt nicht mehr genug Marken");

                console.log(this.alreadUsedParents.get(idString));
                console.log(this.alreadUsedParents);
            }
        });

        return noConflicts;
    }

    private fireSingleTransition(element: Transition) {
        const targetLine = this._diagram!.lines?.filter(line => line.target.id === element.id);
        // eingehende Linie holen und prüfen, ob die parents (der Vorbereich) genug Marken haben
        if(!this.parentsHaveEnoughTokens(element.parents, targetLine!)) {
            return;
        }

        element.parents.forEach((place) => {
            const line = this._diagram!.lines?.find(line => line.source.id === place.id && line.target.id === element.id);
            this.subtractTokensFromPlace(place, line!.tokens);
        });

        element.children.forEach((place) => {
            const line = this._diagram!.lines?.find(line => line.source.id === element.id && line.target.id === place.id);
            this.addTokensToPlace(place, line!.tokens);
        });

        this.setTransitionColor(element,'black');

        return;
    }

    public fireStep() {
        this.currentChosenTransitions.forEach((transition) => {
            this.fireSingleTransition(transition);
        });
    }

    private subtractTokensFromPlace(place: Place, amountTokenLine: number): void {

        place.amountToken -= amountTokenLine;

        if(place.amountToken <= 0){
            place.amountToken = 0;
            place.svgElement!.childNodes[1].textContent = '';
        }
        else{
            place.svgElement!.childNodes[1].textContent = place.amountToken.toString();
        }
    }

    private addTokensToPlace(place: Place, amount: number): void {

        place.amountToken += amount;

        place.svgElement!.childNodes[1].textContent = place.amountToken.toString();
    }

    public setTransitionColor(transition: Transition, color: string): void {
        transition.svgElement?.querySelector('rect')!.setAttribute('fill', color);
    }

    public shuffle(startTransitions: Array<Transition>) {
        // startTransitions wird mit dem Fisher-Yates-Shuffle zufällig angeordnet
        let m = startTransitions.length, t, i;

        while(m) {
            i = Math.floor(Math.random()*m--);

            t = startTransitions[m];
            startTransitions[m] = startTransitions[i];
            startTransitions[i] = t;
        }

        return startTransitions;
    }
}
