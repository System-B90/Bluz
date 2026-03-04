import { useState, useEffect, useCallback, useMemo, ChangeEventHandler } from 'react';
import
{
    Card, CardContent, Typography, Button, TextField, Box, ButtonGroup,
    CardHeader, CardActions, Paper, Table, TableHead, TableRow, TableCell,
    TableBody, Skeleton,
    TableFooter,
    IconButton,
    Tooltip
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import { SyllabusId, Syllabus, ModuleId, Module, makeModule } from "@/api-shared/types/curriculum";
import { ModuleProvider, ModulesProvider, useModule, useModules } from "@/components/curriculum/module-provider";
import { useSyllabus } from "@/components/curriculum/syllabus-provider";
import { BaseDocument } from "@/api-client/curriculum/curriculum";
import EditIcon from '@mui/icons-material/Edit';
function ModuleRow()
{
    const { data: module, setData: setModule, openDialog } = useModule();

    const editClickHandler = useCallback(() =>
    {
        if (!module) { return; }
        openDialog();
    }, [ module, openDialog ]);

    // Show skeletons while loading to prevent "Cannot read properties of undefined" errors
    if (!module)
    {
        return (
            <TableRow>
                <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                <TableCell><Skeleton variant="text" width="40px" /></TableCell>
                <TableCell><Skeleton variant="text" width="40px" /></TableCell>
                <TableCell>
                    <IconButton size='small' onClick={ editClickHandler }>
                        <EditIcon fontSize='small' />
                    </IconButton>
                </TableCell>
            </TableRow>
        );
    }

    return (
        <TableRow>
            <TableCell>
                <Typography>{ module.title }</Typography>
            </TableCell>
            <TableCell>{ module.neededTime }</TableCell>
            <TableCell>{ module.allocatedTime }</TableCell>
            <TableCell>
                <IconButton size='small' onClick={ editClickHandler }>
                    <EditIcon fontSize='small' />
                </IconButton>
            </TableCell>
        </TableRow>
    );
}

function CreateModuleButton({ callback }: { callback: (newModule: Module & BaseDocument) => void; })
{
    const { create } = useModules();

    const clickHandler = useCallback(() =>
    {
        create(makeModule()).then((newModule) => callback(newModule));
    }, [ create, callback ]);

    return (

        <Tooltip title='מערך חדש' placement='top'>
            <IconButton size="small" color="secondary" onClick={ clickHandler }>
                <AddIcon fontSize='small' />
            </IconButton>
        </Tooltip>
    );
}

function SyllabusSaveButton({ syllabus }: { syllabus: Syllabus | undefined; })
{
    const { update: updateSyllabus } = useSyllabus();
    const clickHandler = useCallback(() =>
    {
        if (!syllabus) { return; }
        updateSyllabus(syllabus);
    }, [ syllabus, updateSyllabus ]);
    return (
        <Button size="small" variant="contained" startIcon={ <SaveIcon /> } onClick={ clickHandler }>
            <Typography>שמור</Typography>
        </Button>
    );
}

type UpdateCallback = (updates: Partial<Omit<Syllabus, 'id'>>) => void;

function SyllabusName({ syllabus, update }: { syllabus: Syllabus | undefined; update: UpdateCallback; })
{
    const onChange: ChangeEventHandler<HTMLInputElement> = useCallback((e) =>
    {
        update({ title: e.target.value });
    }, [ update ]);

    return (
        <TextField
            label='שם הסילבוס'
            size="small"
            value={ syllabus?.title ?? '' }
            onChange={ onChange }
            variant='standard'
            required={ true }
            type='text'
        />
    );
}

function ModulesTable({ syllabus, moduleCreateCallback }: { syllabus: Syllabus; moduleCreateCallback: (newModule: Module & BaseDocument) => void; })
{
    const moduleRows = useMemo(() =>
    {
        return (syllabus.modules ?? []).map((moduleId) => (
            <ModuleProvider itemId={ moduleId } key={ moduleId }><ModuleRow moduleId={ moduleId } /></ModuleProvider>
        ));
    }, [ syllabus?.modules ]);

    return (
        <Box sx={ { overflowY: 'auto', paddingBottom: 1, paddingTop: 0, marginY: 1, marginX: 0, paddingX: 0.5, flexGrow: 1 } }>
            <Table size="small" stickyHeader={ true }>
                <TableHead>
                    <TableRow>
                        <TableCell>שם המערך</TableCell>
                        <TableCell>זמן רצוי</TableCell>
                        <TableCell>זמן מוקצב</TableCell>
                        <TableCell width={ '1rem' }>
                            <CreateModuleButton callback={ moduleCreateCallback } />
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    { moduleRows }
                </TableBody>
                <TableFooter>

                </TableFooter>
            </Table>
        </Box>
    );
}

function SyllabusCardInner({ syllabusId }: { syllabusId: SyllabusId; })
{
    const { get: getSyllabus } = useSyllabus();
    const [ syllabus, setSyllabus ] = useState<Syllabus>();

    const moduleCreateCallback = useCallback((newModule: Module & BaseDocument) =>
    {
        setSyllabus((prev) => prev ? ({ ...prev, modules: [ ...prev.modules, newModule.id ] }) : undefined);
    }, []);

    useEffect(() =>
    {
        getSyllabus(syllabusId).then(setSyllabus);
    }, [ syllabusId, getSyllabus ]);

    const modulesTable = useMemo(() => syllabus !== undefined ? (<ModulesTable syllabus={ syllabus } moduleCreateCallback={ moduleCreateCallback } />) : undefined, [ syllabus ]);

    const updateLocalSyllabus = useCallback((updates: Partial<Omit<Syllabus, 'id'>>) =>
    {
        setSyllabus((prev) => prev ? ({ ...prev, ...updates }) : undefined);
    }, []);

    return (
        <>
            <CardContent sx={ {
                display: 'flex', flexDirection: 'column', paddingY: 0.5, margin: 0, flex: 1, overflow: 'hidden',
            } }>
                <SyllabusName syllabus={ syllabus } update={ updateLocalSyllabus } />
                { modulesTable }
            </CardContent>
            <CardActions>
                <ButtonGroup>
                    <SyllabusSaveButton syllabus={ syllabus } />
                </ButtonGroup>
            </CardActions>
        </>
    );
}

export default function SyllabusCard({ syllabusId }: { syllabusId: SyllabusId; })
{
    return (
        <Card sx={ { display: 'flex', flexDirection: 'column', width: '30%', maxHeight: '90%', overflow: 'hidden' } }>
            <CardHeader
                title={ <Typography variant='caption' padding={ 0 } margin={ 0 }>סילבוס</Typography> }
                sx={ { margin: 0, paddingY: 0, paddingX: 1 } }
            />
            <ModulesProvider params={ { syllabusId } }>
                <SyllabusCardInner syllabusId={ syllabusId } />
            </ModulesProvider>
        </Card>
    );
}
