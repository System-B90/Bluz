export async function GET(request: NextRequest)
{
    try
    {
        const fullCurriculum = await db.query.curriculums.findFirst({
            where: eq(curriculums.id, requestedId),
            with: {
                curriculumSyllabuses: {
                    with: {
                        syllabus: {
                            with: {
                                syllabusModules: {
                                    with: {
                                        module: {
                                            with: { events: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    } catch (e)
    {
        return catchHandler(request, e);
    }
}