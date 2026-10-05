/** Stable authored forms use existing serialized coat/age traits, never fresh runtime randomness. */
export const ANIMAL_FORMS:Readonly<Record<string,number>>={
 deer:3,toucan:3,orangutan:3,jaguar:3,
 tiger:3,hippo:2,bison:2,blackBear:3,zebra:3,giraffe:3,elephant:3,wolf:3,monkey:3,
 squirrel:3,boar:3,beaver:2,crocodile:2,toad:3,boa:3,smallSnake:3,
 macaw:3,parakeet:3,kingfisher:3,seagull:3,hawk:2,vulture:2,fish:3,whale:2,
};
const AGE_FORMS=new Set(['deer','orangutan','giraffe','elephant','wolf','monkey']);
export function animalForm(kind:string,coat:number,juvenile=false):number {
 const count=ANIMAL_FORMS[kind]??1;
 return AGE_FORMS.has(kind)?juvenile?2:coat%2:coat%count;
}
export function animalPrefix(kind:string,form=0):string{return `${kind}${form?`-form${form}`:''}`;}
export function animalForms(kind:string):number[]{return Array.from({length:ANIMAL_FORMS[kind]??1},(_,i)=>i);}
