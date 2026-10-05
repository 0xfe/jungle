/** Linear stance cancels world travel; eased swing lifts the foot clear of the ground. */
export function plantedStep(phase:number,stance:number,excursion:number,height:number):{fore:number;lift:number}{
 const t=((phase%1)+1)%1,u=Math.max(0,(t-stance)/(1-stance));
 return{fore:(t<stance?.5-t/stance:-.5+u*u*(3-2*u))*excursion,lift:t<stance?0:Math.sin(u*Math.PI)*height};
}
