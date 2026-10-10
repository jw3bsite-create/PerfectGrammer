import type { Task } from '../lib/types';
import type { ExerciseProps } from './common';
import { KommaExercise } from './Komma';
import { EintippenExercise, EntscheidenExercise, UmformenExercise, WortExercise } from './Typed';
import { FehlerExercise, KorrekturExercise } from './Fehler';
import { TextwiedergabeExercise } from './Textwiedergabe';

export const TYP_LABEL: Record<Task['typ'], string> = {
  probe: 'Probe durchführen',
  komma: 'Komma setzen',
  eintippen: 'Form eintippen',
  entscheiden: 'Entscheiden',
  umformen: 'Umformen',
  fehler: 'Fehler finden',
  wort: 'Wort tippen',
  fehlertyp: 'Fehlertyp bestimmen',
  textwiedergabe: 'Textwiedergabe',
  korrektur: 'Korrekturlesen',
};

export function TaskView(props: Omit<ExerciseProps, 'task'> & { task: Task }) {
  const { task } = props;
  switch (task.typ) {
    case 'probe':
    case 'komma':
      return <KommaExercise {...props} task={task} />;
    case 'eintippen':
      return <EintippenExercise {...props} task={task} />;
    case 'entscheiden':
      return <EntscheidenExercise {...props} task={task} />;
    case 'umformen':
      return <UmformenExercise {...props} task={task} />;
    case 'fehler':
    case 'fehlertyp':
      return <FehlerExercise {...props} task={task} />;
    case 'wort':
      return <WortExercise {...props} task={task} />;
    case 'textwiedergabe':
      return <TextwiedergabeExercise {...props} task={task} />;
    case 'korrektur':
      return <KorrekturExercise {...props} task={task} />;
  }
}
