/**
 * The Bundestag's wordmark as an address, not as a component.
 *
 * IT IS NOT USED ON THE STAGE ALONE. The stage header lays it as a mask over
 * a colour area, so that it follows the world's text colour
 * (`StageHeader`). A host that simply needs it as an image - for instance
 * the quiz selection at the desk, which sits on a light background - gets
 * the same file here. A second copy in the application repository would be a
 * mark that would have to be maintained in two places.
 */
import wordmark from '../assets/images/logo.svg'

/** Address of the bundled wordmark, via the package's build path. */
export const brandWordmarkUrl: string = wordmark
