import * as React from 'npm:react@18.3.1';
import {Heading,Text} from 'npm:@react-email/components@0.0.22';
import {TraceaShell,h1,text} from './_tracea-shell.tsx';
import type {TemplateEntry} from './registry.ts';
function Aviso({organizacion,suplente,cargo,inicio,fin,facultades,motivo}:{organizacion:string;suplente:string;cargo:string;inicio:string;fin:string;facultades:string;motivo:string}){return <TraceaShell preview={`Suplencia registrada en ${organizacion}`}><Heading style={h1}>Aviso al Responsable Sanitario</Heading><Text style={text}>{organizacion}: se registró una suplencia para {suplente}, {cargo}.</Text><Text style={text}>Vigencia: {inicio} a {fin}. Facultades: {facultades}.</Text><Text style={text}>Motivo: {motivo}</Text></TraceaShell>;}
export const template={component:Aviso,subject:'Suplencia registrada — TRACEA',displayName:'Aviso de suplencia al RS'} satisfies TemplateEntry;