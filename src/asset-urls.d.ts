/** Build-time file imports become content-hashed URLs relative to the JS bundle. */
declare module '*?url' {
  const url: string;
  export default url;
}

declare module '*?atlas' {const url:string;export default url;}
