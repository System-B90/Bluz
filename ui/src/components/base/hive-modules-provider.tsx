'use client';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { apiGetModules } from '@/api-client/hive';
import { Module, ModuleLike } from '@/components/schedule/types/module';
import { SubjectLike } from '@/components/schedule/types/subject';
import { enqueueSnackbar } from 'notistack';
import
{
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';


export type HiveModulesContextState = {
    default: boolean;
    modules: Array<Module>;
    getModule: (id: ModuleLike) => Module | undefined;
    getModulesOfSubject: (subject: SubjectLike) => Array<Module>;
};

const HiveModulesContext = createContext<HiveModulesContextState | undefined>({
    default: true,
    modules: [],
    getModule: (_id: ModuleLike) => undefined,
    getModulesOfSubject: (_subject: SubjectLike) => [],
});

export const HiveModulesProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ moduleLookup, setModuleLookup ] = useState<Record<string, Module>>({});

    const modules = useMemo(() => Object.values(moduleLookup), [ moduleLookup ]);
    const getModule = useCallback((id: ModuleLike) => id instanceof Object ? id : moduleLookup[ id as number ], [ moduleLookup ]);

    const getModulesOfSubject = useCallback((subject: SubjectLike) =>
        modules.filter((module) => module.parent_subject === (subject instanceof Object ? subject.id : subject as number)),
        [ modules ]);

    const loadModules = useCallback(() =>
    {
        apiGetModules().then((fetchedModules) =>
        {
            const modulesMap: Record<string, Module> = {};
            fetchedModules.forEach((module) =>
            {
                modulesMap[ module.id ] = module;
            });
            setModuleLookup(modulesMap);
        }).catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'טעינת המודולים נכשלה.', error));
    }, [ setModuleLookup ]);

    useEffect(() =>
    {
        loadModules();
    }, [ loadModules ]);

    return (
        <HiveModulesContext.Provider value={ {
            default: false,
            modules,
            getModule,
            getModulesOfSubject,
        } }>
            { children }
        </HiveModulesContext.Provider>
    );
};

export const useHiveModules = () =>
{
    const context = useContext(HiveModulesContext);

    if (context === undefined || context.default)
    {
        throw new Error('useHiveModules must be used within an HiveModulesProvider');
    }

    return context;
};
